import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import type { GeneratedArticle, InstagramPost, ScrapingRule } from "./types.js";

let supabase: SupabaseClient | undefined;

function client(): SupabaseClient {
  supabase ??= createClient(config.supabaseUrl, config.supabaseServiceKey);
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
}

export async function saveArticle(
  article: GeneratedArticle,
  post: InstagramPost,
  sourceUrl: string,
  thumbnailUrl: string,
  publishedAt: string | null,
  sourceAccount: string,
): Promise<SavedArticleIds> {
  // 1. 記事メタを articles に保存（source_account = 取得元IGハンドル）
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
      source_account: sourceAccount,
    })
    .select("id")
    .single();
  if (articleError || !inserted) {
    throw new Error(`articles への保存に失敗: ${articleError?.message ?? "id 未返却"}`);
  }

  // 2. 本文セクションを article_parts に一括保存（material_id は廃止し null）
  const rows = article.parts.map((text, i) => ({
    article_id: inserted.id,
    description: text,
    sort_order: i + 1,
  }));
  const { error: partsError } = await client().from("article_parts").insert(rows);
  if (partsError) {
    await client().from("articles").delete().eq("id", inserted.id);
    throw new Error(
      `article_parts への保存に失敗 (article_id: ${inserted.id}): ${partsError.message}\n` +
        `→ articles 行はロールバック(削除)されました。`,
    );
  }

  // 3. キャプションに実名で出た商品のみ materials に保存（記事単位 article_id 紐付け）
  //    捏造はしない方針のため、materials が空の記事は商品行を作らない。
  if (article.materials.length > 0) {
    const materialRows = article.materials.map((m) => ({
      article_id: inserted.id,
      brand: m.maker ?? "",
      product_name: m.product_name ?? "",
      model_number: m.model_number ?? "",
      category: m.category ?? article.category,
      image_url: "",
      caption: post.caption?.text?.slice(0, 500) ?? "",
    }));
    const { error: matError } = await client().from("materials").insert(materialRows);
    if (matError) {
      // 商品情報の保存失敗は記事本体まで巻き戻さない（記事自体に価値があるため）。ログに留める。
      console.error(`  materials の保存に失敗(記事は保持) (article_id: ${inserted.id}): ${matError.message}`);
    }
  }

  return { articleId: inserted.id };
}

/**
 * 作成した記事をDBから物理削除するロールバック用関数。
 * Storage保存に失敗した際などに呼び出す。
 * materials は article_id の ON DELETE CASCADE で自動削除される。
 */
export async function deleteArticle(articleId: string): Promise<void> {
  await client().from("article_parts").delete().eq("article_id", articleId);
  await client().from("articles").delete().eq("id", articleId); // materials は CASCADE
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

/**
 * データベースから有効なスクレイピングルールを取得する。
 * テーブルが存在しない場合は、開発用のスタブ（デフォルトルール）を返す。
 */
export async function fetchActiveScrapingRules(): Promise<ScrapingRule[]> {
  const { data, error } = await client().from("scraping_rules").select("*").eq("is_active", true);

  if (error) {
    // テーブルが存在しない場合(42P01など)は、環境変数の設定をフォールバックとして返す
    console.warn(`⚠️ scraping_rules テーブルの取得に失敗しました。環境変数の設定をモックとして使用します: ${error.message}`);
    return [
      {
        id: "mock-rule-1",
        name: "デフォルトルール (環境変数)",
        target_type: "handle",
        target_value: config.instagramHandle,
        min_likes: 0,
        min_comments: 0,
        media_types: [], // 空はすべて許可
        ignore_keywords: [],
        require_keywords: [],
        is_active: true,
      },
    ];
  }

  return data as ScrapingRule[];
}
