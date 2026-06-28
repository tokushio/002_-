import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.includes("xxxx")) {
    throw new Error(
      `環境変数 ${name} が未設定またはプレースホルダのままです。.env を確認してください。`,
    );
  }
  return value;
}

export const config = {
  get supabaseUrl() {
    return required("SUPABASE_URL");
  },
  get supabaseKey() {
    return required("SUPABASE_KEY");
  },
  /** Storageアップロード等、RLSをバイパスする必要がある操作に使うservice_roleキー */
  get supabaseServiceKey() {
    return required("SUPABASE_SERVICE_KEY");
  },
  /** 2026-06-27追加: Gemini(Google AI Studio)のAPIキー。batch.ts(Batch API、現在休止中)専用。 */
  get geminiApiKey() {
    return required("GEMINI_API_KEY");
  },
  /**
   * 記事生成に使うGeminiモデル(batch.ts専用。逐次パスは2026-06-28にOpenRouter経由へ移行)。
   * 2026-06-27: gemini-3.5-flashが503(高負荷)で不安定だったため一時的にgemini-2.5-flashに変更。
   * 安定したら GEMINI_MODEL=gemini-3.5-flash で手動アップグレード可能。
   */
  get geminiModel() {
    return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  },
  /**
   * 2026-06-28追加: OpenRouter(https://openrouter.ai)のAPIキー。逐次生成パスのデフォルト経路。
   * Google AI Studio無料枠のRPD(1日あたりリクエスト数)上限を回避するため、
   * 同じGeminiモデルをOpenRouterの有料クレジット経由で呼ぶ(モデル自体はvisionありGeminiを継続使用)。
   */
  get openrouterApiKey() {
    return required("OPENROUTER_API_KEY");
  },
  /** OpenRouter上のモデルID。"プロバイダー/モデル名"形式。 */
  get openrouterModel() {
    return process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";
  },
  get sociavaultApiKey() {
    return required("SOCIAVAULT_API_KEY");
  },
  /** 未設定の場合は空文字(Unsplashからのサムネイル取得をスキップする) */
  get unsplashAccessKey() {
    return process.env.UNSPLASH_ACCESS_KEY ?? "";
  },
  get instagramHandle() {
    return required("INSTAGRAM_HANDLE");
  },
  /** trueの場合、ページネーションで投稿を全件取得する */
  get fetchAll() {
    return (process.env.FETCH_ALL ?? "false").toLowerCase() === "true";
  },
  /** 取得する投稿数の上限。未設定・不正値の場合は上限なし(undefined) */
  get maxPosts(): number | undefined {
    const raw = process.env.MAX_POSTS;
    if (!raw) {
      return undefined;
    }
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  },
};
