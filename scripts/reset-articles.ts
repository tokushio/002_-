import { createClient } from "@supabase/supabase-js";
import { config } from "../src/config.js";

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

// 前回のテスト生成(eyefulhomeoitahigashi)で作成された10件の記事のsource_url
const sourceUrls = [
  "https://www.instagram.com/p/DZcajanCWad/",
  "https://www.instagram.com/p/DZZ10XHklzw/",
  "https://www.instagram.com/p/DZXNpKUjJK5/",
  "https://www.instagram.com/p/DZMzfL4jFmI/",
  "https://www.instagram.com/p/DZH0Nmkkrms/",
  "https://www.instagram.com/p/DZFS-DnDWT5/",
  "https://www.instagram.com/p/DY64zZkAb1s/",
  "https://www.instagram.com/p/DY4UActiP32/",
  "https://www.instagram.com/p/DYzN2oKjafQ/",
  "https://www.instagram.com/p/DYo3V26DZnl/",
];

const { data: articles, error: articlesError } = await supabase
  .from("articles")
  .select("id, source_url")
  .in("source_url", sourceUrls);
if (articlesError) throw new Error(`articles取得失敗: ${articlesError.message}`);

const articleIds = (articles ?? []).map((a) => a.id);
console.log(`対象記事: ${articleIds.length}件`);

if (articleIds.length > 0) {
  const { error: partsError } = await supabase
    .from("article_parts")
    .delete()
    .in("article_id", articleIds);
  if (partsError) throw new Error(`article_parts削除失敗: ${partsError.message}`);
  console.log("article_parts削除完了");

  const { error: deleteArticlesError } = await supabase
    .from("articles")
    .delete()
    .in("id", articleIds);
  if (deleteArticlesError) throw new Error(`articles削除失敗: ${deleteArticlesError.message}`);
  console.log("articles削除完了");
}

console.log("リセット完了");
