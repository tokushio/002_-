import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

/** Batch APIに投げる1リクエスト(custom_idで結果を突き合わせる)。 */
export interface BatchRequest {
  custom_id: string;
  params: Anthropic.MessageCreateParamsNonStreaming;
}

let client: Anthropic | undefined;
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}

/**
 * Message Batches APIにまとめて投げ、完了までポーリングして
 * custom_id -> 成功メッセージ のMapを返す(全トークン50%オフ)。
 * 失敗/期限切れの結果はログに出してMapに含めない。
 */
export async function runBatch(
  requests: BatchRequest[],
  pollMs = 20000,
): Promise<Map<string, Anthropic.Message>> {
  const results = new Map<string, Anthropic.Message>();
  if (requests.length === 0) return results;

  const batch = await getClient().messages.batches.create({ requests });
  console.log(`バッチ送信: ${batch.id} (${requests.length}件) — 完了までポーリングします`);

  let status = batch;
  while (status.processing_status !== "ended") {
    await new Promise((r) => setTimeout(r, pollMs));
    status = await getClient().messages.batches.retrieve(batch.id);
    const c = status.request_counts;
    process.stdout.write(
      `\r  状態: ${status.processing_status} | 完了 ${c.succeeded} / 失敗 ${c.errored} / 処理中 ${c.processing}   `,
    );
  }
  process.stdout.write("\n");

  for await (const r of await getClient().messages.batches.results(batch.id)) {
    if (r.result.type === "succeeded") {
      results.set(r.custom_id, r.result.message);
    } else {
      console.error(`  ✗ ${r.custom_id}: ${r.result.type}`);
    }
  }
  return results;
}
