import { config } from "../src/config.js";
import { generateArticle } from "../src/claude.js";
import type { InstagramPost } from "../src/types.js";

// 指定URLの投稿を単体取得し、DB保存せずに記事生成だけ試す(ドライラン)。
const URL = process.argv[2] ?? "https://www.instagram.com/p/DZuEm3TDw_w/";
const BASE = "https://api.sociavault.com/v1/scrape/instagram";

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
  console.error("投稿本体(xdt_shortcode_media)が取得できませんでした");
  process.exit(1);
}

const mediaType = node.__typename === "XDTGraphVideo" ? 2 : node.__typename === "XDTGraphSidecar" ? 8 : 1;
const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text ?? null;
const handle = node.owner?.username ?? "(unknown)";
const carouselUrls = toArray(node.edge_sidecar_to_children?.edges)
  .map((e: any) => e.node?.display_url)
  .filter(Boolean);

const post: InstagramPost = {
  pk: node.id,
  code: node.shortcode,
  taken_at: node.taken_at_timestamp ?? 0,
  media_type: mediaType,
  caption: caption ? { text: caption } : null,
  like_count: node.edge_media_preview_like?.count ?? node.edge_liked_by?.count,
  comment_count: node.edge_media_to_parent_comment?.count ?? node.edge_media_preview_comment?.count,
  display_uri: node.display_url,
  carouselUrls: carouselUrls.length ? carouselUrls : node.display_url ? [node.display_url] : [],
};

console.log("====================================================");
console.log(`投稿: @${handle}  media_type=${mediaType}  like=${post.like_count}  comment=${post.comment_count}`);
console.log("=== キャプション全文 ===");
console.log(caption ?? "(キャプションなし)");
console.log("====================================================");
console.log("記事を生成中(DB保存なし)...");

const article = await generateArticle(post, []);

console.log("\n========== 生成結果(ドライラン・未保存) ==========");
if (article.skip) {
  console.log(`SKIP: ${article.skipReason}`);
} else {
  console.log(`タイトル: ${article.title}`);
  console.log(`カテゴリ: ${article.category}`);
  console.log(`投稿元: ${handle}`);
  console.log(`イントロ: ${article.intro}`);
  console.log(`タグ: ${article.tags.join(", ")}`);
  console.log(`スコア: ${article.scoreInfo.total}点 (${article.scoreInfo.articleType})`);
  console.log("\n--- パーツ ---");
  article.parts.forEach((p, i) => {
    console.log(`\n[パーツ${i + 1}]`);
    console.log(p);
  });
  console.log("\n--- materials(抽出商品) ---");
  if (article.materials.length === 0) {
    console.log("(なし)");
  } else {
    article.materials.forEach((m) =>
      console.log(`・maker=${m.maker || "(空)"} / product=${m.product_name} / model=${m.model_number || "(空)"} / cat=${m.category}`),
    );
  }
}
