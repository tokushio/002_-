import { config } from "../src/config.js";
import { generateArticle } from "../src/claude.js";
import {
  articleExists,
  deleteArticle,
  saveArticle,
  updateArticleThumbnail,
  updatePartImage,
} from "../src/db.js";
import { saveCarouselImages, deleteArticleImages } from "../src/storage.js";
import { fetchThumbnailUrl } from "../src/unsplash.js";
import type { InstagramPost } from "../src/types.js";

// 指定URLの投稿1件を取得し、新プロンプトで記事を生成して **実DBに保存** する。
// 既存記事は削除しない(単体追加)。
const URL = process.argv[2] ?? "https://www.instagram.com/p/DZuEm3TDw_w/";
const BASE = "https://api.sociavault.com/v1/scrape/instagram";
const MAX_CAROUSEL_IMAGES = 5;

function toArray<T>(v: T[] | Record<string, T> | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : Object.values(v);
}

const res = await fetch(`${BASE}/post-info?${new URLSearchParams({ url: URL })}`, {
  headers: { "X-API-Key": config.sociavaultApiKey },
});
if (!res.ok) {
  console.error(`post-info取得失敗 (${res.status})`);
  process.exit(1);
}
const json: any = await res.json();
const node: any = json?.data?.data?.xdt_shortcode_media;
if (!node) {
  console.error("投稿本体が取得できませんでした");
  process.exit(1);
}

const mediaType = node.__typename === "XDTGraphVideo" ? 2 : node.__typename === "XDTGraphSidecar" ? 8 : 1;
const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text ?? null;
const handle = node.owner?.username ?? "unknown";
const carouselUrls = toArray(node.edge_sidecar_to_children?.edges)
  .map((e: any) => e.node?.display_url)
  .filter(Boolean);

const post: InstagramPost = {
  pk: node.id,
  code: node.shortcode,
  taken_at: node.taken_at_timestamp ?? Math.floor(Date.now() / 1000),
  media_type: mediaType,
  caption: caption ? { text: caption } : null,
  like_count: node.edge_media_preview_like?.count ?? node.edge_liked_by?.count,
  comment_count: node.edge_media_to_parent_comment?.count ?? node.edge_media_preview_comment?.count,
  display_uri: node.display_url,
  carouselUrls: carouselUrls.length ? carouselUrls : node.display_url ? [node.display_url] : [],
};

const sourceUrl = `https://www.instagram.com/p/${post.code}/`;

if (await articleExists(sourceUrl)) {
  console.log(`既に同じ投稿の記事が存在します: ${sourceUrl}`);
  process.exit(0);
}

console.log(`@${handle} の投稿で記事生成中(新プロンプト)...`);
const article = await generateArticle(post, []);

if (article.skip || article.scoreInfo.total === 0) {
  console.log(`スキップ: ${article.skipReason ?? "生成前チェック"}`);
  process.exit(0);
}
if (article.scoreInfo.total < 60) {
  console.log(`スコア60点未満(${article.scoreInfo.total})のため保存しません`);
  process.exit(0);
}

const thumbnailUrl = (await fetchThumbnailUrl(article)) ?? post.display_uri ?? "";
const publishedAt = new Date().toISOString();
const { articleId } = await saveArticle(article, post, sourceUrl, thumbnailUrl, publishedAt, handle);
console.log(`保存しました article_id=${articleId} / ${article.scoreInfo.total}点 / ${article.title}`);

try {
  const urls = (post.carouselUrls?.length ? post.carouselUrls : post.display_uri ? [post.display_uri] : [])
    .slice(0, MAX_CAROUSEL_IMAGES);
  const imageMap = await saveCarouselImages(urls, articleId);
  const mainImage = imageMap[0];
  if (mainImage) await updateArticleThumbnail(articleId, mainImage);
  for (let p = 0; p < article.parts.length; p++) {
    if (imageMap[p]) await updatePartImage(articleId, p + 1, imageMap[p] as string);
  }
  console.log("画像の永続化完了");
} catch (err) {
  console.error(`画像永続化に失敗、記事をロールバックします: ${err instanceof Error ? err.message : err}`);
  await deleteArticle(articleId);
  await deleteArticleImages(articleId);
  process.exit(1);
}

console.log("\n========== 保存した記事 ==========");
console.log(`カテゴリ: ${article.category} / 投稿元: ${handle} / 商品: ${article.materials.length}件`);
article.parts.forEach((p, i) => console.log(`\n[パーツ${i + 1}]\n${p}`));
console.log("\n--- materials ---");
article.materials.forEach((m) =>
  console.log(`・maker=${m.maker || "(空)"} / product=${m.product_name} / model=${m.model_number || "(空)"}`),
);
