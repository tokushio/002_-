import { config } from "./config.js";
import { generateArticle } from "./claude.js";
import { articleExists, deleteArticle, fetchActiveScrapingRules, saveArticle, updateArticleThumbnail, updatePartImage } from "./db.js";
import { fetchAllPosts, fetchComments, postUrlFromCode } from "./sociavault.js";
import { saveCarouselImages } from "./storage.js";
import { fetchThumbnailUrl } from "./unsplash.js";
import type { InstagramComment } from "./types.js";

/** カルーセル画像のうちStorageに保存する最大枚数 */
const MAX_CAROUSEL_IMAGES = 5;

/** APIレート制限対策のウェイト処理用 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const rules = await fetchActiveScrapingRules();
  console.log(`${rules.length}件の有効なスクレイピングルールが見つかりました。`);

  let totalCreated = 0;
  let totalSkipped = 0;
  const published: number[] = [];
  const revisedPublished: number[] = [];
  const drafts: number[] = [];

  for (const rule of rules) {
    console.log(`\n======================================================`);
    console.log(`▶ ルール実行開始: ${rule.name}`);
    console.log(`======================================================`);

    if (rule.target_type !== "handle") {
      console.warn(`⚠️ 現在はアカウント指定(handle)のみ対応しています。このルールをスキップします。`);
      continue;
    }

    const handle = rule.target_value;
    console.log(`@${handle} の投稿を取得中...`);

    const posts = await fetchAllPosts(handle, {
      fetchAll: config.fetchAll,
      maxPosts: config.maxPosts,
      onProgress: (count) => process.stdout.write(`\r投稿取得中... ${count}件目`),
    });
    process.stdout.write("\n");

    if (posts.length === 0) {
      console.log("投稿が見つかりませんでした。");
      continue;
    }
    console.log(`${posts.length} 件の投稿を取得しました。`);

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const url = postUrlFromCode(post.code);
      try {
        if (await articleExists(url)) {
          console.log(`スキップ [重複]: ${url}`);
          totalSkipped++;
          continue;
        }
        if (!post.caption?.text) {
          console.log(`スキップ [キャプションなし]: ${url}`);
          totalSkipped++;
          continue;
        }

        // --- 動的フィルタリング（足切り）ロジック ---
        if (rule.media_types && rule.media_types.length > 0 && !rule.media_types.includes(post.media_type)) {
          console.log(`スキップ [対象メディア外 (media_type=${post.media_type})]: ${url}`);
          totalSkipped++;
          continue;
        }

        if ((post.like_count || 0) < rule.min_likes) {
          console.log(`スキップ [いいね不足 (${post.like_count || 0} < ${rule.min_likes})]: ${url}`);
          totalSkipped++;
          continue;
        }

        if ((post.comment_count || 0) < rule.min_comments) {
          console.log(`スキップ [コメント不足 (${post.comment_count || 0} < ${rule.min_comments})]: ${url}`);
          totalSkipped++;
          continue;
        }

        if (rule.ignore_keywords && rule.ignore_keywords.length > 0) {
          const matchedNg = rule.ignore_keywords.find((kw) => post.caption!.text.includes(kw));
          if (matchedNg) {
            console.log(`スキップ [NGワード検知 (${matchedNg})]: ${url}`);
            totalSkipped++;
            continue;
          }
        }

        if (rule.require_keywords && rule.require_keywords.length > 0) {
          const hasRequired = rule.require_keywords.some((kw) => post.caption!.text.includes(kw));
          if (!hasRequired) {
            console.log(`スキップ [必須ワードなし]: ${url}`);
            totalSkipped++;
            continue;
          }
        }
        // --- フィルタリングここまで ---

        const preview = post.caption.text.replace(/\s+/g, " ").slice(0, 20);
        console.log(`記事生成中 [${i + 1}/${posts.length}]: ${preview}...`);

      let comments: InstagramComment[] = [];
      try {
        comments = await fetchComments(url);
      } catch (err) {
        console.error(`  コメント取得に失敗(キャプションのみで生成します): ${url}`);
        console.error(`  ${err instanceof Error ? err.message : err}`);
      }

      const article = await generateArticle(post, comments);

      if (article.skip || article.scoreInfo.total === 0 || article.title.includes("SKIP")) {
        console.log(`⏭️  スキップ [${article.skipReason ?? "生成前チェック対象"}]: ${url}`);
        totalSkipped++;
        continue;
      }

      const thumbnailUrl = (await fetchThumbnailUrl(article)) ?? post.display_uri ?? "";

      const { total, articleType } = article.scoreInfo;
      
      if (total < 60) {
        console.log(`⏭️  スキップ [スコア60点未満: ${total}点・${articleType}] ${article.title}`);
        totalSkipped++;
        drafts.push(total);
        continue;
      }

      const publishedAt = new Date().toISOString();
      const { articleId } = await saveArticle(article, post, url, thumbnailUrl, publishedAt, handle);
      totalCreated++;
      let isSuccess = false;

      try {
        const carouselUrls = (
          post.carouselUrls?.length ? post.carouselUrls : post.display_uri ? [post.display_uri] : []
        ).slice(0, MAX_CAROUSEL_IMAGES);
        const imageMap = await saveCarouselImages(carouselUrls, articleId);

        const mainImage = imageMap[0];
        if (mainImage) {
          await updateArticleThumbnail(articleId, mainImage);
        }
        for (let p = 0; p < article.parts.length; p++) {
          const permanentUrl = imageMap[p];
          if (permanentUrl) {
            await updatePartImage(articleId, p + 1, permanentUrl);
          }
        }
        isSuccess = true;
      } catch (err) {
        console.error(`  画像の永続化処理でエラー (article_id: ${articleId}):`);
        console.error(`  ${err instanceof Error ? err.message : err}`);
        console.error(`  → DBに保存された記事データをロールバック(削除)します。`);
        await deleteArticle(articleId);
        totalCreated--;
        totalSkipped++;
      }

      if (isSuccess) {
        if (total >= 80) {
          console.log(`✅ [${total}点・${articleType}] ${article.title}`);
          published.push(total);
        } else {
          console.log(
            `🔧 修正後保存 [${article.beforeScore}→${total}点・${articleType}] ${article.title}`,
          );
          revisedPublished.push(total);
        }
      }
    } catch (err) {
      console.error(`  エラー: ${url}`);
      console.error(`  ${err instanceof Error ? err.message : err}`);
      totalSkipped++;
    }

    // 次の投稿処理の前に5秒間待機（APIレート制限対策）
    if (i < posts.length - 1) {
      console.log(`  ⏳ API制限対策のため 5秒待機します...`);
      await delay(5000);
    }
  } // for (posts)
} // for (rules)

  const avg = (scores: number[]) =>
    scores.length === 0 ? 0 : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  console.log(`
=============================
完了サマリー
=============================
✅ 公開保存：${published.length}件（平均スコア：${avg(published)}点）
🔧 修正後公開：${revisedPublished.length}件（平均スコア：${avg(revisedPublished)}点）
📝 下書きスキップ：${drafts.length}件（平均スコア：${avg(drafts)}点）
⏭️  完全スキップ(足切り等)：${totalSkipped}件
=============================
`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
