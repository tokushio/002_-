import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import type { GeneratedArticle, InstagramPost } from "./types.js";

let supabase: SupabaseClient | undefined;

function client(): SupabaseClient {
  supabase ??= createClient(config.supabaseUrl, config.supabaseKey);
  return supabase;
}

/**
 * 実テーブル構造(2026-06-11 PostgREST経由で確認・INSERT検証済み):
 * - articles:      id(uuid), title, intro, category, thumbnail_url, source_url,
 *                  source_tags(text[]), generated_by(default 'ai'),
 *                  published_at(default now), created_at
 * - article_parts: id, article_id, material_id(NOT NULL), description, sort_order, created_at,
 *                  image_url(画像永続化機能で追加。要マイグレーション)
 * - materials:     id, image_url, caption, created_at,
 *                  brand(NOT NULL), product_name(NOT NULL), category,
 *                  model_number(default ''), confidence(default 1)
 *
 * 保存フロー: materials(投稿素材) → articles(記事メタ) → article_parts(本文セクション)
 * 現状は投稿1件につき material 1行を作成し、全パートが同じ material を参照する。
 * (カルーセル投稿のスライドごとに素材を分ける場合はここを拡張する)
 * materials.brand には INSTAGRAM_HANDLE、product_name/category には生成記事の
 * title/category を流用している(投稿=製品紹介とは限らないための暫定対応)。
 *
 * articles.thumbnail_url は Unsplash API(src/unsplash.ts)で取得した住宅系画像を使用。
 * 取得失敗・APIキー未設定時は post.display_uri にフォールバックする(index.ts側で解決)。
 */

/** 同じ投稿から既に記事が作られていないか source_url で確認 */
export async function articleExists(sourceUrl: string): Promise<boolean> {
  const { data, error } = await client()
    .from("articles")
    .select("id")
    .eq("source_url", sourceUrl)
    .limit(1);
  if (error) {
    throw new Error(`articles の重複確認に失敗: ${error.message}`);
  }
  return (data?.length ?? 0) > 0;
}

export interface SavedArticleIds {
  articleId: string;
  materialId: string;
}

export async function saveArticle(
  article: GeneratedArticle,
  post: InstagramPost,
  sourceUrl: string,
  thumbnailUrl: string,
  publishedAt: string | null,
): Promise<SavedArticleIds> {
  // 1. 投稿素材を materials に保存
  const { data: material, error: materialError } = await client()
    .from("materials")
    .insert({
      image_url: post.display_uri ?? "",
      caption: post.caption?.text ?? "",
      brand: config.instagramHandle,
      product_name: article.title,
      category: article.category,
    })
    .select("id")
    .single();
  if (materialError || !material) {
    throw new Error(`materials への保存に失敗: ${materialError?.message ?? "id 未返却"}`);
  }

  // 2. 記事メタを articles に保存
  const { data: inserted, error: articleError } = await client()
    .from("articles")
    .insert({
      title: article.title,
      intro: article.intro,
      category: article.category,
      thumbnail_url: thumbnailUrl,
      source_url: sourceUrl,
      source_tags: article.tags,
      published_at: publishedAt,
    })
    .select("id")
    .single();
  if (articleError || !inserted) {
    throw new Error(
      `articles への保存に失敗: ${articleError?.message ?? "id 未返却"}\n` +
        `→ materials 行 (id: ${material.id}) は作成済みです。`,
    );
  }

  // 3. 本文セクションを article_parts に一括保存
  const rows = article.parts.map((text, i) => ({
    article_id: inserted.id,
    material_id: material.id,
    description: text,
    sort_order: i + 1,
  }));
  const { error: partsError } = await client().from("article_parts").insert(rows);
  if (partsError) {
    throw new Error(
      `article_parts への保存に失敗 (article_id: ${inserted.id}): ${partsError.message}\n` +
        `→ articles / materials 行は作成済みです。再実行時はこの投稿はスキップされるため、必要なら手動で削除してください。`,
    );
  }

  return { articleId: inserted.id, materialId: material.id };
}

/** articles.thumbnail_url を永続URLに更新する */
export async function updateArticleThumbnail(articleId: string, thumbnailUrl: string): Promise<void> {
  const { error } = await client().from("articles").update({ thumbnail_url: thumbnailUrl }).eq("id", articleId);
  if (error) {
    throw new Error(`articles.thumbnail_url の更新に失敗 (article_id: ${articleId}): ${error.message}`);
  }
}

/** article_parts.image_url を永続URLに更新する */
export async function updatePartImage(
  articleId: string,
  sortOrder: number,
  imageUrl: string,
): Promise<void> {
  const { error } = await client()
    .from("article_parts")
    .update({ image_url: imageUrl })
    .eq("article_id", articleId)
    .eq("sort_order", sortOrder);
  if (error) {
    throw new Error(
      `article_parts.image_url の更新に失敗 (article_id: ${articleId}, sort_order: ${sortOrder}): ${error.message}`,
    );
  }
}

/** materials.image_url を永続URLに更新する */
export async function updateMaterialImage(materialId: string, imageUrl: string): Promise<void> {
  const { error } = await client().from("materials").update({ image_url: imageUrl }).eq("id", materialId);
  if (error) {
    throw new Error(`materials.image_url の更新に失敗 (material_id: ${materialId}): ${error.message}`);
  }
}
