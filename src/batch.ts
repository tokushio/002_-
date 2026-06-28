import { config } from "./config.js";
import { parseArticleJsonText, type ArticleWithScore } from "./claude.js";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/** Gemini Batch APIに投げる1リクエスト(custom_idで結果を突き合わせる)。 */
export interface BatchRequest {
  custom_id: string;
  /** buildGeminiRequestBody()が返すcontents/systemInstruction/generationConfig */
  body: Record<string, unknown>;
}

async function batchFetch(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${BASE_URL}/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.geminiApiKey,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini Batch APIエラー (${res.status}) ${path}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

const TERMINAL_STATES = new Set([
  "JOB_STATE_SUCCEEDED",
  "JOB_STATE_FAILED",
  "JOB_STATE_CANCELLED",
  "JOB_STATE_EXPIRED",
]);

/**
 * Gemini Batch API(batchGenerateContent)にまとめて投げ、完了までポーリングして
 * custom_id -> ArticleWithScore のMapを返す(全トークン50%オフ・24時間以内に完了)。
 * 失敗/期限切れの結果はログに出してMapに含めない。
 */
export async function runBatch(
  requests: BatchRequest[],
  pollMs = 20000,
): Promise<Map<string, ArticleWithScore>> {
  const results = new Map<string, ArticleWithScore>();
  if (requests.length === 0) return results;

  const model = config.geminiModel;
  const created = await batchFetch(`models/${model}:batchGenerateContent`, {
    method: "POST",
    body: JSON.stringify({
      batch: {
        display_name: `article-batch-${Date.now()}`,
        input_config: {
          requests: {
            requests: requests.map((r) => ({ request: r.body, metadata: { key: r.custom_id } })),
          },
        },
      },
    }),
  });

  const batchName: string = created.name;
  console.log(`バッチ送信: ${batchName} (${requests.length}件) — 完了までポーリングします`);

  let status = created;
  let state: string = status.metadata?.state ?? "JOB_STATE_PENDING";
  while (!TERMINAL_STATES.has(state)) {
    await new Promise((r) => setTimeout(r, pollMs));
    status = await batchFetch(batchName);
    state = status.metadata?.state ?? state;
    process.stdout.write(`\r  状態: ${state}   `);
  }
  process.stdout.write("\n");

  if (state !== "JOB_STATE_SUCCEEDED") {
    console.error(`  バッチが${state}で終了しました`);
    return results;
  }

  const inlined: any[] = status.response?.inlinedResponses ?? [];
  for (const item of inlined) {
    const key: string | undefined = item.metadata?.key;
    if (!key) continue;
    if (item.error) {
      console.error(`  ✗ ${key}: ${item.error.message ?? JSON.stringify(item.error)}`);
      continue;
    }
    const candidate = item.response?.candidates?.[0];
    const raw: string = candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    if (!raw) {
      console.error(`  ✗ ${key}: 空レスポンス (finishReason: ${candidate?.finishReason ?? "不明"})`);
      continue;
    }
    try {
      results.set(key, parseArticleJsonText(raw));
    } catch (e) {
      console.error(`  ✗ ${key} パース失敗: ${e instanceof Error ? e.message : e}`);
    }
  }
  return results;
}
