import { config } from "./config.js";
import { generateArticle } from "./claude.js";
import { articleExists, saveArticle, updateArticleThumbnail, updateMaterialImage, updatePartImage } from "./db.js";
import { fetchAllPosts, fetchComments, postUrlFromCode } from "./sociavault.js";
import { saveCarouselImages } from "./storage.js";
import { fetchThumbnailUrl } from "./unsplash.js";
import type { InstagramComment } from "./types.js";

/** カルーセル画像のうちStorageに保存する最大枚数 */
const MAX_CAROUSEL_IMAGES = 5;

async function main() {
  const handle = config.instagramHandle;
  console.log(`@${handle} の投稿を取得中...`);

  const posts = await fetchAllPosts(handle, {
    fetchAll: config.fetchAll,
    maxPosts: config.maxPosts,
    onProgress: (count) => process.stdout.write(`\r投稿取得中... ${count}件目`),
  });
  process.stdout.write("\n");

  if (posts.length === 0) {
    console.log("投稿が見つかりませんでした。");
    return;
  }
  console.log(`${posts.length} 件の投稿を取得しました。`);

  let created = 0;
  let skipped = 0;
  const published: number[] = [];
  const revisedPublished: number[] = [];
  const drafts: number[] = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const url = postUrlFromCode(post.code);
    try {
      if (await articleExists(url)) {
        console.log(`スキップ [重複]: ${url}`);
        skipped++;
        continue;
      }
      if (!post.caption?.text) {
        console.log(`スキップ [キャプションなし]: ${url}`);
        skipped++;
        continue;
      }

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
        console.log(`⏭️  スキップ [${article.skipReason ?? "生成前チェック対象"}]: @${handle}`);
        skipped++;
        continue;
      }

      const thumbnailUrl = (await fetchThumbnailUrl(article)) ?? post.display_uri ?? "";

      const { total, articleType } = article.scoreInfo;
      const publishedAt = total >= 60 ? new Date().toISOString() : null;
      const { articleId, materialId } = await saveArticle(article, post, url, thumbnailUrl, publishedAt);
      created++;

      try {
        const carouselUrls = (
          post.carouselUrls?.length ? post.carouselUrls : post.display_uri ? [post.display_uri] : []
        ).slice(0, MAX_CAROUSEL_IMAGES);
        const imageMap = await saveCarouselImages(carouselUrls, articleId);

        const mainImage = imageMap[0];
        if (mainImage) {
          await updateArticleThumbnail(articleId, mainImage);
          await updateMaterialImage(materialId, mainImage);
        }
        for (let p = 0; p < article.parts.length; p++) {
          const permanentUrl = imageMap[p];
          if (permanentUrl) {
            await updatePartImage(articleId, p + 1, permanentUrl);
          }
        }
      } catch (err) {
        console.error(`  画像の永続化処理でエラー (article_id: ${articleId}):`);
        console.error(`  ${err instanceof Error ? err.message : err}`);
      }

      if (total >= 80) {
        console.log(`✅ [${total}点・${articleType}] ${article.title}`);
        published.push(total);
      } else if (total >= 60) {
        console.log(
          `🔧 修正後保存 [${article.beforeScore}→${total}点・${articleType}] ${article.title}`,
        );
        revisedPublished.push(total);
      } else {
        console.log(`📝 下書き保存 [${total}点・${articleType}] ${article.title}`);
        drafts.push(total);
      }
    } catch (err) {
      console.error(`  エラー: ${url}`);
      console.error(`  ${err instanceof Error ? err.message : err}`);
      skipped++;
    }
  }

  const avg = (scores: number[]) =>
    scores.length === 0 ? 0 : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  console.log(`
=============================
完了サマリー
=============================
✅ 公開保存：${published.length}件（平均スコア：${avg(published)}点）
🔧 修正後公開：${revisedPublished.length}件（平均スコア：${avg(revisedPublished)}点）
📝 下書き保存：${drafts.length}件（平均スコア：${avg(drafts)}点）
⏭️  スキップ：${skipped}件
=============================
`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
