import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import { saveImageToStorage } from "../storage.js";

const BUCKET = "article-images";
const STORAGE_URL_PREFIX = `${config.supabaseUrl}/storage/v1/object/public/${BUCKET}/`;

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

/** 既にStorageへ移行済みのURLかどうか */
function isAlreadyMigrated(url: string | null): boolean {
  return Boolean(url?.startsWith(STORAGE_URL_PREFIX));
}

async function main() {
  // 1. article-images バケットの存在確認
  // (listBuckets()はanon/publishableキーではRLSにより空配列を返すため、
  //  バケット自体への list() アクセスで存在確認する)
  const { error: bucketError } = await supabase.storage.from(BUCKET).list("", { limit: 1 });
  if (bucketError && /not found/i.test(bucketError.message)) {
    console.error(
      `バケット '${BUCKET}' が存在しません。Supabaseダッシュボード(Storage)で作成してから再実行してください。`,
    );
    process.exit(1);
  }
  if (bucketError) {
    console.error(`バケット '${BUCKET}' へのアクセスに失敗: ${bucketError.message}`);
    process.exit(1);
  }

  // 2. 全記事を取得
  const { data: articles, error: articlesError } = await supabase
    .from("articles")
    .select("id, thumbnail_url");
  if (articlesError || !articles) {
    throw new Error(`articles の取得に失敗: ${articlesError?.message ?? "不明なエラー"}`);
  }
  console.log(`${articles.length} 件の記事を処理します。\n`);

  let thumbnailSaved = 0;
  let thumbnailSkipped = 0;
  let materialSaved = 0;
  let materialSkipped = 0;

  for (const article of articles) {
    // 3. articles.thumbnail_url をStorageに保存し直す
    if (!article.thumbnail_url) {
      console.log(`- [${article.id}] thumbnail_url 未設定のためスキップ`);
      thumbnailSkipped++;
    } else if (isAlreadyMigrated(article.thumbnail_url)) {
      console.log(`- [${article.id}] thumbnail は既に移行済み`);
      thumbnailSkipped++;
    } else {
      const permanentUrl = await saveImageToStorage(article.thumbnail_url, article.id, "thumbnail");
      if (permanentUrl) {
        const { error } = await supabase
          .from("articles")
          .update({ thumbnail_url: permanentUrl })
          .eq("id", article.id);
        if (error) {
          console.error(`- [${article.id}] articles.thumbnail_url の更新に失敗: ${error.message}`);
          thumbnailSkipped++;
        } else {
          console.log(`✅ [${article.id}] thumbnail → ${permanentUrl}`);
          thumbnailSaved++;
        }
      } else {
        thumbnailSkipped++;
      }
    }

    // 4. article_parts経由でmaterials.image_urlも同様に更新する
    const { data: parts, error: partsError } = await supabase
      .from("article_parts")
      .select("material_id")
      .eq("article_id", article.id);
    if (partsError) {
      console.error(`- [${article.id}] article_parts の取得に失敗: ${partsError.message}`);
      continue;
    }

    const materialIds = [...new Set((parts ?? []).map((p) => p.material_id as string))];
    for (const materialId of materialIds) {
      const { data: material, error: materialError } = await supabase
        .from("materials")
        .select("id, image_url")
        .eq("id", materialId)
        .single();
      if (materialError || !material) {
        console.error(`- [${article.id}] materials(${materialId}) の取得に失敗: ${materialError?.message ?? "不明なエラー"}`);
        materialSkipped++;
        continue;
      }
      if (!material.image_url) {
        materialSkipped++;
        continue;
      }
      if (isAlreadyMigrated(material.image_url)) {
        console.log(`- [${article.id}] material(${materialId}) は既に移行済み`);
        materialSkipped++;
        continue;
      }

      const permanentUrl = await saveImageToStorage(material.image_url, article.id, `material-${materialId}`);
      if (permanentUrl) {
        const { error } = await supabase
          .from("materials")
          .update({ image_url: permanentUrl })
          .eq("id", materialId);
        if (error) {
          console.error(`- [${article.id}] materials(${materialId}).image_url の更新に失敗: ${error.message}`);
          materialSkipped++;
        } else {
          console.log(`✅ [${article.id}] material(${materialId}) → ${permanentUrl}`);
          materialSaved++;
        }
      } else {
        materialSkipped++;
      }
    }
  }

  console.log(`
=============================
完了サマリー
=============================
サムネイル: 保存 ${thumbnailSaved}件 / スキップ ${thumbnailSkipped}件
素材画像  : 保存 ${materialSaved}件 / スキップ ${materialSkipped}件
=============================
`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
