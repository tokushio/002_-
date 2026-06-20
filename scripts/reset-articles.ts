import { createClient } from "@supabase/supabase-js";
import { config } from "../src/config.js";

// 014でRLSを厳格化したため、削除は service_role キー(RLSバイパス)で行う。
const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

// 全 article_parts → 全 articles の順に削除。
// materials は articles への ON DELETE CASCADE(migration 015) で連動削除される。
const { error: partsError } = await supabase
  .from("article_parts")
  .delete()
  .not("id", "is", null);
if (partsError) throw new Error(`article_parts削除失敗: ${partsError.message}`);
console.log("article_parts 全削除完了");

const { data: deletedArticles, error: articlesError } = await supabase
  .from("articles")
  .delete()
  .not("id", "is", null)
  .select("id");
if (articlesError) throw new Error(`articles削除失敗: ${articlesError.message}`);
console.log(`articles 全削除完了 (${deletedArticles?.length ?? 0}件)`);

// 旧プレースホルダー由来の孤児 materials(article_id が null)を掃除する。
const { data: orphans, error: orphanError } = await supabase
  .from("materials")
  .delete()
  .is("article_id", null)
  .select("id");
if (orphanError) throw new Error(`孤児materials削除失敗: ${orphanError.message}`);
console.log(`孤児materials削除完了 (${orphans?.length ?? 0}件)`);

console.log("リセット完了");
