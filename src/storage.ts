import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";

const BUCKET = "article-images";

let supabase: SupabaseClient | undefined;

/** Storageアップロード/upsertはRLSをバイパスするためservice_roleキーで接続する */
function client(): SupabaseClient {
  supabase ??= createClient(config.supabaseUrl, config.supabaseServiceKey);
  return supabase;
}

/**
 * 画像URLをサーバー側でfetchし、Supabase Storage(article-images)にアップロードして
 * 永続公開URLを返す。取得・アップロードに失敗した場合はnullを返す。
 */
export async function saveImageToStorage(
  imageUrl: string,
  articleId: string,
  fileLabel: string | number,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      throw new Error(`画像取得に失敗 (${res.status}): ${imageUrl}`);
    }
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const path = `${articleId}/${fileLabel}.jpg`;

    const { error } = await client().storage.from(BUCKET).upload(path, buffer, {
      contentType,
      upsert: true,
    });
    if (error) {
      throw new Error(`Storageアップロードに失敗 (${path}): ${error.message}`);
    }

    const { data } = client().storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error(
      `  画像の永続化に失敗 (${imageUrl}): ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }
}

/**
 * カルーセル画像URLをすべてStorageに保存し、永続URLの配列を返す。
 * 戻り値の各要素は入力と同じインデックスに対応し、保存に失敗した要素はnullになる
 * (呼び出し側でカルーセル順 = パーツ番号の対応を保つため)。
 */
export async function saveCarouselImages(
  carouselUrls: string[],
  articleId: string,
): Promise<(string | null)[]> {
  const results: (string | null)[] = [];
  for (let i = 0; i < carouselUrls.length; i++) {
    results.push(await saveImageToStorage(carouselUrls[i], articleId, i + 1));
  }
  return results;
}

/**
 * 記事に紐づくStorage画像(${articleId}/*)を一括削除する。
 * 記事のロールバック時に、アップロード済みの孤児画像が残らないようにする。
 */
export async function deleteArticleImages(articleId: string): Promise<void> {
  try {
    const { data: files, error } = await client().storage.from(BUCKET).list(articleId);
    if (error) throw error;
    if (files && files.length > 0) {
      const paths = files.map((f) => `${articleId}/${f.name}`);
      await client().storage.from(BUCKET).remove(paths);
    }
  } catch (err) {
    console.error(
      `  Storage画像の削除に失敗 (article ${articleId}): ${err instanceof Error ? err.message : err}`,
    );
  }
}
