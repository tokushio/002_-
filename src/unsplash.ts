import { config } from "./config.js";
import type { GeneratedArticle } from "./types.js";

/** source_tags の日本語キーワード → Unsplash検索用の英語キーワード(簡易マッピング) */
const JA_EN_KEYWORDS: Record<string, string> = {
  間取り: "floor plan",
  間取り図: "floor plan",
  キッチン: "kitchen",
  洗面: "bathroom",
  洗面所: "bathroom",
  トイレ: "bathroom",
  バス: "bathroom",
  浴室: "bathroom",
  リビング: "living room",
  ダイニング: "dining room",
  寝室: "bedroom",
  ベッドルーム: "bedroom",
  外観: "house exterior",
  玄関: "entrance hallway",
  庭: "garden yard",
  収納: "storage interior",
  クローゼット: "closet interior",
  注文住宅: "custom home",
  新築: "new house",
  一戸建て: "house exterior",
  マイホーム: "house interior",
  内装: "interior design",
  インテリア: "interior design",
  家具: "furniture interior",
  照明: "interior lighting",
  窓: "window interior",
  屋根: "roof house",
  デザイン: "house design",
  住まい: "house interior",
  暮らし: "home living",
  断熱: "house insulation",
  耐震: "house architecture",
  工務店: "house construction",
};

/** カテゴリに応じたベースクエリ */
const CATEGORY_QUERIES: Record<string, string> = {
  ldk: "modern living room kitchen japan",
  washroom: "japanese bathroom washroom interior",
  toilet: "modern toilet interior design",
  exterior: "japanese house exterior modern",
  other: "japanese interior house design",
};

/** タイトル内のキーワード → 追加クエリ */
const TITLE_KEYWORDS: [string, string][] = [
  ["吹き抜け", "vaulted ceiling"],
  ["平屋", "single story house"],
  ["キッチン", "kitchen interior"],
  ["洗面", "bathroom vanity"],
  ["収納", "storage interior"],
  ["動線", "open floor plan"],
  ["外観", "house facade"],
  ["リビング", "living room"],
  ["寝室", "bedroom interior"],
  ["和室", "japanese tatami room"],
  ["ジャパンディ", "japandi interior"],
  ["ナチュラル", "natural wood interior"],
  ["ホテルライク", "hotel like interior"],
];

/** タグを翻訳辞書と照合し、Unsplash検索用の英語キーワードを返す。見つからなければnull */
function translateTag(tag: string): string | null {
  const cleaned = tag.replace(/^#/, "").trim();
  if (JA_EN_KEYWORDS[cleaned]) {
    return JA_EN_KEYWORDS[cleaned];
  }
  for (const [ja, en] of Object.entries(JA_EN_KEYWORDS)) {
    if (cleaned.includes(ja)) {
      return en;
    }
  }
  return null;
}

/** カテゴリ文字列からクエリ種別を判定する */
function detectCategoryKey(category: string): keyof typeof CATEGORY_QUERIES {
  if (/LDK|リビング|ダイニング|キッチン/i.test(category)) {
    return "ldk";
  }
  if (/洗面|浴室|バス|風呂/.test(category)) {
    return "washroom";
  }
  if (/トイレ/.test(category)) {
    return "toilet";
  }
  if (/外観|外構|エクステリア/.test(category)) {
    return "exterior";
  }
  return "other";
}

/** title / category / tags を組み合わせてUnsplash検索クエリを生成する */
function buildQuery(article: GeneratedArticle): string {
  const parts: string[] = [CATEGORY_QUERIES[detectCategoryKey(article.category)]];

  for (const tag of article.tags.slice(0, 2)) {
    const translated = translateTag(tag);
    if (translated) {
      parts.push(translated);
    }
  }

  for (const [ja, en] of TITLE_KEYWORDS) {
    if (article.title.includes(ja)) {
      parts.push(en);
    }
  }

  return parts.join(" ");
}

/**
 * 記事のtitle / category / tagsをもとにUnsplashから住宅系画像を1枚取得し、画像URLを返す。
 * APIキー未設定・取得失敗時はnullを返す(記事生成自体は失敗させない)。
 */
export async function fetchThumbnailUrl(article: GeneratedArticle): Promise<string | null> {
  if (!config.unsplashAccessKey) {
    return null;
  }

  const query = buildQuery(article);
  const page = Math.floor(Math.random() * 5) + 1;
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&page=${page}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${config.unsplashAccessKey}` },
    });
    if (!res.ok) {
      console.error(`Unsplash API エラー (${res.status}): query="${query}" page=${page}`);
      return null;
    }

    const json = (await res.json()) as { results?: Array<{ urls?: { regular?: string } }> };
    return json.results?.[0]?.urls?.regular ?? null;
  } catch (err) {
    console.error(`Unsplash API 呼び出しに失敗: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}
