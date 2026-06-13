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
  get anthropicApiKey() {
    return required("ANTHROPIC_API_KEY");
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
