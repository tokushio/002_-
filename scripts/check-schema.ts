/**
 * publicスキーマのテーブル一覧と、articles / article_parts の構造を確認するスクリプト。
 *
 * SQL:
 *   SELECT table_name FROM information_schema.tables
 *   WHERE table_schema = 'public' ORDER BY table_name;
 * は publishableキー + PostgREST では直接実行できないため、
 * PostgREST が公開する OpenAPI 定義 (GET /rest/v1/) から同じ情報を取得します。
 */
import "dotenv/config";

interface OpenApiColumn {
  type?: string;
  format?: string;
  description?: string;
  default?: unknown;
}

interface OpenApiSpec {
  definitions?: Record<string, { properties?: Record<string, OpenApiColumn>; required?: string[] }>;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key || url.includes("xxxx") || key.includes("xxxx")) {
    throw new Error("SUPABASE_URL / SUPABASE_KEY を .env に設定してください(プレースホルダのままです)。");
  }

  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    throw new Error(`Supabase への接続に失敗 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const spec = (await res.json()) as OpenApiSpec;
  const definitions = spec.definitions ?? {};
  const tables = Object.keys(definitions).sort();

  console.log("== public スキーマのテーブル一覧 ==");
  if (tables.length === 0) {
    console.log("(APIに公開されているテーブルがありません)");
  }
  for (const t of tables) console.log(`- ${t}`);

  for (const target of ["articles", "article_parts"]) {
    console.log(`\n== ${target} の構造 ==`);
    const def = definitions[target];
    if (!def?.properties) {
      console.log("(テーブルが見つかりません)");
      continue;
    }
    const required = new Set(def.required ?? []);
    for (const [name, col] of Object.entries(def.properties)) {
      const type = col.format ?? col.type ?? "unknown";
      const flags = [
        required.has(name) ? "NOT NULL" : "",
        col.description?.includes("Primary Key") ? "PK" : "",
        col.default !== undefined ? `default: ${col.default}` : "",
      ]
        .filter(Boolean)
        .join(", ");
      console.log(`- ${name}: ${type}${flags ? `  (${flags})` : ""}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
