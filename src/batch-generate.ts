import { config } from "./config.js";
import {
  articleExists,
  deleteArticle,
  fetchActiveScrapingRules,
  saveArticle,
  updateArticleThumbnail,
  updatePartImage,
} from "./db.js";
import { fetchAllPosts, postUrlFromCode } from "./sociavault.js";
import { saveCarouselImages, deleteArticleImages } from "./storage.js";
import { fetchThumbnailUrl } from "./unsplash.js";
import {
  SYSTEM_PROMPT,
  REVISION_SYSTEM_PROMPT,
  SCORE_THRESHOLD,
  buildUserPrompt,
  buildRequestBody,
  buildRevisionPrompt,
  parseArticleMessage,
  toGeneratedArticle,
  fetchImageBlocks,
  imageUrlsForPost,
  shouldUseVision,
  type ArticleWithScore,
} from "./claude.js";
import { runBatch, type BatchRequest } from "./batch.js";
import type { InstagramPost, ScrapingRule } from "./types.js";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Batches版の記事生成。逐次版(index.ts)と同じフィルタ/保存ロジックを使いつつ、
 * Claude呼び出しだけをまとめてMessage Batches API(全トークン50%オフ・非同期)に投げる。
 * 逐次版は壊さず、こちらは `npm run generate:batch` で起動する追加パス。
 */

const MAX_CAROUSEL_IMAGES = 5;

interface Candidate {
  code: string;
  url: string;
  handle: string;
  post: InstagramPost;
  userPrompt: string;
  images: Anthropic.ImageBlockParam[];
}

/** index.tsと同等の足切り判定(コメントはBatch版では入力に含めない=API節約)。 */
function passesFilters(post: InstagramPost, rule: ScrapingRule): { ok: boolean; reason?: string } {
  if (!post.caption?.text) return { ok: false, reason: "キャプションなし" };
  if (rule.media_types?.length && !rule.media_types.includes(post.media_type)) {
    return { ok: false, reason: `対象メディア外(media_type=${post.media_type})` };
  }
  if ((post.like_count || 0) < rule.min_likes) return { ok: false, reason: "いいね不足" };
  if ((post.comment_count || 0) < rule.min_comments) return { ok: false, reason: "コメント不足" };
  if (rule.ignore_keywords?.length) {
    const ng = rule.ignore_keywords.find((kw) => post.caption!.text.includes(kw));
    if (ng) return { ok: false, reason: `NGワード(${ng})` };
  }
  if (rule.require_keywords?.length) {
    const has = rule.require_keywords.some((kw) => post.caption!.text.includes(kw));
    if (!has) return { ok: false, reason: "必須ワードなし" };
  }
  return { ok: true };
}

async function collectCandidates(): Promise<Candidate[]> {
  const rules = await fetchActiveScrapingRules();
  console.log(`${rules.length}件の有効なスクレイピングルール`);
  const candidates: Candidate[] = [];

  for (const rule of rules) {
    if (rule.target_type !== "handle") continue;
    const posts = await fetchAllPosts(rule.target_value, {
      fetchAll: config.fetchAll,
      maxPosts: config.maxPosts,
    });
    console.log(`@${rule.target_value}: ${posts.length}件取得`);

    for (const post of posts) {
      const url = postUrlFromCode(post.code);
      if (await articleExists(url)) {
        console.log(`  スキップ[重複]: ${url}`);
        continue;
      }
      const f = passesFilters(post, rule);
      if (!f.ok) {
        console.log(`  スキップ[${f.reason}]: ${url}`);
        continue;
      }
      const images = shouldUseVision(post.caption?.text)
        ? await fetchImageBlocks(imageUrlsForPost(post))
        : [];
      candidates.push({
        code: post.code,
        url,
        handle: rule.target_value,
        post,
        userPrompt: buildUserPrompt(post, []),
        images,
      });
    }
  }
  return candidates;
}

async function main() {
  const candidates = await collectCandidates();
  if (candidates.length === 0) {
    console.log("対象投稿がありません。");
    return;
  }
  console.log(`\n候補 ${candidates.length}件 をBatchで生成します。`);

  // ── Batch 1: 生成 ──
  const genRequests: BatchRequest[] = candidates.map((c) => ({
    custom_id: c.code,
    params: buildRequestBody(SYSTEM_PROMPT, c.userPrompt, c.images),
  }));
  const genResults = await runBatch(genRequests);

  // 結果をパースし、低スコアは修正バッチへ
  const drafts = new Map<string, ArticleWithScore>();
  const reviseRequests: BatchRequest[] = [];
  for (const c of candidates) {
    const msg = genResults.get(c.code);
    if (!msg) continue;
    let art: ArticleWithScore;
    try {
      art = parseArticleMessage(msg);
    } catch (e) {
      console.error(`  パース失敗 ${c.code}: ${e instanceof Error ? e.message : e}`);
      continue;
    }
    if (art.skip || art.scoreInfo.total === 0) {
      console.log(`  スキップ[生成前チェック] ${c.code}: ${art.skipReason ?? ""}`);
      continue;
    }
    drafts.set(c.code, art);
    if (art.scoreInfo.total < SCORE_THRESHOLD) {
      reviseRequests.push({
        custom_id: c.code,
        params: buildRequestBody(REVISION_SYSTEM_PROMPT, buildRevisionPrompt(c.userPrompt, art), c.images),
      });
    }
  }

  // ── Batch 2: 修正(スコア80未満のみ) ──
  if (reviseRequests.length > 0) {
    console.log(`\n${reviseRequests.length}件を修正バッチで再生成します。`);
    const revResults = await runBatch(reviseRequests);
    for (const [code, msg] of revResults) {
      try {
        drafts.set(code, parseArticleMessage(msg));
      } catch (e) {
        console.error(`  修正パース失敗 ${code}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  // ── 保存 ──
  const byCode = new Map(candidates.map((c) => [c.code, c]));
  let created = 0;
  let skipped = 0;
  for (const [code, art] of drafts) {
    if (art.scoreInfo.total < 60) {
      console.log(`  下書きスキップ(${art.scoreInfo.total}点) ${code}`);
      skipped++;
      continue;
    }
    const c = byCode.get(code)!;
    const gen = toGeneratedArticle(art);
    const thumb = (await fetchThumbnailUrl(gen)) ?? c.post.display_uri ?? "";
    const { articleId } = await saveArticle(gen, c.post, c.url, thumb, new Date().toISOString(), c.handle);
    created++;

    try {
      const urls = (c.post.carouselUrls?.length ? c.post.carouselUrls : c.post.display_uri ? [c.post.display_uri] : [])
        .slice(0, MAX_CAROUSEL_IMAGES);
      const imageMap = await saveCarouselImages(urls, articleId);
      if (imageMap[0]) await updateArticleThumbnail(articleId, imageMap[0]);
      for (let p = 0; p < gen.parts.length; p++) {
        if (imageMap[p]) await updatePartImage(articleId, p + 1, imageMap[p] as string);
      }
      console.log(`  ✅ [${art.scoreInfo.total}点] ${gen.title}`);
    } catch (e) {
      console.error(`  画像永続化失敗、ロールバック ${code}: ${e instanceof Error ? e.message : e}`);
      await deleteArticle(articleId);
      await deleteArticleImages(articleId);
      created--;
      skipped++;
    }
  }

  console.log(`\n=============================`);
  console.log(`Batch完了: 保存 ${created}件 / スキップ ${skipped}件`);
  console.log(`=============================`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
