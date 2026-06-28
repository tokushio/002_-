import { z } from "zod";
import { config } from "./config.js";
import type { GeneratedArticle, InstagramComment, InstagramPost } from "./types.js";

/** スコアが この点未満の場合のみ、2回目の修正APIを呼ぶ(100点満点) */
export const SCORE_THRESHOLD = 80;

const ScoreInfoSchema = z.object({
  articleType: z
    .string()
    .describe("記事タイプ(自由記述。例: 体感系・後悔防止系・建材紹介系・比較系など)"),
  fixedScores: z.object({
    experience: z
      .number()
      .describe("体感・暮らし視点(0〜20点)。「住んだらどう感じるか」の描写があるか"),
    specificity: z
      .number()
      .describe("情報の具体性(0〜20点)。建材・サイズ・メーカーなど具体的な情報があるか"),
    cta: z
      .number()
      .describe("CTA節度(0〜20点)。「→」アクション行が0〜1個に収まり、全パーツに繰り返していないか。多用は減点"),
  }),
  dynamicScores: z
    .array(
      z.object({
        axis: z
          .string()
          .describe(
            "記事タイプに応じて選定した動的評価軸の名前" +
              "(例: 体感系→「空間・感覚の表現力」、後悔防止系→「共感度」「チェックポイントの明確さ」、" +
              "建材系→「建材の具体性」「比較視点」)",
          ),
        score: z.number().describe("0〜20点"),
      }),
    )
    .describe("記事タイプに応じた動的評価軸(1〜2個、各0〜20点)"),
  total: z.number().describe("固定3軸+動的軸の合計点(100点満点)"),
  improvements: z.array(z.string()).describe("改善が必要な箇所の具体的な指摘"),
});

// 記事・商品で共通利用するカテゴリ語彙(アプリの RoomCategory と一致させること)
const CATEGORY_VALUES = ["ldk", "washroom", "toilet", "exterior", "layout", "other"] as const;

const MaterialSchema = z.object({
  maker: z
    .string()
    .describe("メーカー・ブランド名(例: TOTO / LIXIL / Panasonic / ニトリ)。キャプションに明記がある場合のみ。無ければ空文字(推測しない)"),
  product_name: z
    .string()
    .describe("商品名・アイテム名(例: 調理台シート / 滑らないハンガー)。キャプションに具体名で登場すれば、メーカー不明でも必ず入れる"),
  model_number: z
    .string()
    .default("")
    .describe("型番・品番。明記がある場合のみ。無ければ空文字。絶対に推測・捏造しない"),
  category: z.enum(CATEGORY_VALUES).describe("この商品が使われる部位"),
});

const ArticleSchema = z.object({
  skip: z
    .boolean()
    .default(false)
    .describe("生成前チェックに1つでも該当し、記事を生成しない場合はtrue"),
  skipReason: z.string().optional().describe("skipがtrueの場合、該当した理由"),
  title: z.string().describe("記事タイトル(30文字前後、検索を意識した自然な日本語)"),
  intro: z.string().describe("導入文(100〜150文字。記事の要点を伝えるリード)"),
  category: z
    .enum(CATEGORY_VALUES)
    .describe(
      "記事カテゴリ。必ず次から最も適切なもの1つ: " +
        "ldk(LDK/キッチン) / washroom(洗面・脱衣) / toilet(トイレ) / exterior(外観・外構) / " +
        "layout(間取り・動線・回遊性など部屋をまたぐ計画) / other(上記に当てはまらない)。" +
        "間取りや家事動線が主題の記事は必ず layout にする。",
    ),
  tags: z.array(z.string()).describe("記事タグ(3〜6個。短い日本語)"),
  parts: z
    .array(z.string())
    .describe(
      "記事本文のセクション配列(3〜6個)。各セクションは次の形式の複数行文字列にする:\n" +
        "・1行目: 【小見出し】\n" +
        "・「・」で始まる“保存価値のある知識行”を1〜3行。住んだ後の気づき・施主の好み・選び方の基準を、" +
        "単体で読んで意味が通る言い切り型で書く。「〜しよう」「〜で確認」「おすすめ」等のTODO・CTA表現は入れない。\n" +
        "  ★行数を埋めるために、キャプションに無い効能・数値・具体策を創作して水増しすることを固く禁止する。" +
        "実質のある内容が1行しかなければ1行でよい。\n" +
        "・「→」で始まる確認/体感アクション行は任意。付けるとしても記事全体で最大1回まで(全パーツに付けない)。" +
        "本当に役立つ確認が無ければ付けない。\n" +
        "①②③などの番号は一切使わない。",
    ),
  materials: z
    .array(MaterialSchema)
    .default([])
    .describe(
      "キャプションに具体名で登場した建材・住宅設備・商品・アイテムを構造化した配列。" +
        "メーカー名が無くても、商品名・アイテム名が具体的に挙がっていれば全て含める(maker/modelは空でよい)。" +
        "特に『N選』『1.〜 2.〜』等の列挙がある場合は、列挙された全アイテムをここに入れる。" +
        "ただしメーカー名・型番を推測して創作することは固く禁止する。商品が一切無ければ空配列。",
    ),
  scoreInfo: ScoreInfoSchema.describe("生成した記事に対する自己評価"),
});

export type ArticleWithScore = z.infer<typeof ArticleSchema>;

export const SYSTEM_PROMPT = `# 記事生成ルール v1.0
## 岡山の家づくり体感まとめ — コンテンツディレクター指示書

---

## あなたの役割

あなたは「岡山の家づくり体感まとめ」アプリのコンテンツディレクターです。
全国の住宅・インテリア系Instagramキャプションを元に、
岡山・倉敷エリアで家づくりを検討する30〜40代施主向けに
**スマートフォンで5秒で読めるノウハウ記事**を生成します。

---

## 🖼️ 最重要：画像内の情報を一次情報として読む

この投稿のカルーセル画像（最大6枚）を添付します。
**多くのリールは、肝心の情報（寸法・数値・型番・メーカー・商品名・間取りの数字）を
キャプションではなく画像内のテキストに焼き込んでいます。**

- **画像に書かれた具体的な数値（例：キッチン高さ86cm、通路幅105cm、洗面79cm）を
  最優先で読み取り、記事本文（parts）の知識行とmaterialsに正確に反映する。**
- キャプションが「寸法を紹介するね」程度しか無くても、画像に具体情報があればそれが本体。
  画像を読まずに一般論でお茶を濁すことを禁止する。
- ただし**画像から読み取れない数値・型番を推測して創作してはならない**（読めたものだけ転記）。
- 画像内の文字が読めない／情報が無い場合のみ、キャプション本文を頼りにする。

---

## 📋 生成前チェック（必須）

以下に1つでも該当する場合は記事を生成せず \\\`SKIP\\\` を返してください。

- [ ] キャンペーン・プレゼント・抽選の告知
- [ ] 採用・求人・スタッフ募集
- [ ] 会社紹介・挨拶・営業時間・休業のお知らせ
- [ ] キャプションが100文字未満
- [ ] 住まい・暮らし・間取り・建材に関するキーワードが1つもない

---

## 📝 絶対厳守ルール

### ルール1：UIノイズの完全排除

各パーツの冒頭に以下を**絶対に記載しない**。

- アカウント名（例：@〇〇）
- 共通の記事タイトル
- カテゴリー名
- 番号の繰り返し（例：「パーツ①」「セクション1」）

各パーツはそのパーツ固有のタイトルのみで始めること。

---

### ルール2：スマホUI最適化（5秒ルール）

- 長文の塊（文字の壁）は**完全に禁止**
- 1パーツの構成：**【タイトル】＋「・」知識行(1〜3)**（＋必要なら記事全体で1つの「→」）
- 接続詞・前置き・まとめ文は極限まで削る
- 体言止めを積極的に使う

---

### ルール3：パーツ数のルール

| 条件 | 対応 |
|------|------|
| 元の内容が薄い（1〜2テーマ） | **無理に3パーツへ水増ししない**。実質のあるテーマ数だけ作る（最小2パーツ可） |
| 元の記事が3〜6パーツ | **そのまま維持**（増減しない） |
| 元の記事が7パーツ以上 | **重要度順に6パーツに絞る** |

⚠️ キャプションが「保存してね」等の前置きだけで中身が薄い場合、
**一般論を創作してパーツ数や行数を埋めてはならない**。書けることが少なければ少ないまま正直に出す。

---

### ルール3.5：列挙(N選・番号リスト)は全項目を保持する

キャプションに「◯◯10選」「1.〜 2.〜 3.〜」のような**番号付き・列挙のリスト**がある場合:

- 列挙された**全アイテムを1つも落とさず**本文に反映する（テーマ別にまとめてもよいが、全項目に触れる）。
- 列挙された全アイテムを **materials 配列にも入れる**（メーカー不明でも product_name を入れる）。
- タイトルに数字を入れる場合（例「10選」）、その数字は**本文で実際に扱ったアイテム数と一致**させる。
  扱えるのが9個なら「9選」にする。**実際より多い数字を掲げない**。

---

### ルール4：箇条書きの構成ルール（保存価値の分離）

各パーツは「保存できる知識行（・）」と「保存できないアクション行（→）」を分けて出力する。
番号（①②③）は一切使わない。説明ラベル（「リスク：」等）も付けない。

| 記号 | 役割 | 行数 | 内容 |
|------|------|------|------|
| **・** | 保存対象（知識・好み・基準） | **1〜3行（実質に応じて可変）** | 単体で読んで意味が通る「住んだ後の気づき」「施主の好み」「選び方の基準」。**言い切り型**。 |
| **→** | 保存対象外（アクション） | **記事全体で0〜1回のみ** | モデルハウス・店頭で体感／確認する行動。本当に有用な時だけ1つ。 |

**行数の水増し禁止**：3行に揃えるために、キャプションに無い効能・数値・具体策を創作してはならない。
実質のある内容が1行ならその1行だけにする。

**「→」アクション行の濫用禁止**：以前は全パーツに「モデルハウスで体感」を付けていたが、
**繰り返しは価値が低く施主にとって邪魔**。→ は記事全体で**最大1つ**、置くなら最も自然なパーツの末尾に1回だけ。
付ける価値が無ければ0個でよい。

**「・」の行に入れてはいけない表現（入れるなら唯一の「→」へ）：**
「〜しよう」「〜で確認」「チェックしよう」「おすすめ」「体感しよう」などのTODO・CTA・行動指示。

❌ 悪い例（保存しても意味が残らない）：
・店頭でクッション性や厚みを実際に触って確認するのがおすすめ
✅ 良い例（保存すると好み・基準として残る）：
・クッション性タイプは食器に優しく、防虫・滑り止め効果もある

数値・型番・メーカー名は**元のキャプションに明記がある場合のみ**使う。無い場合に推測・捏造することを固く禁止する。

---

### ルール4.5：商品・メーカー・型番の構造化抽出（materials）

キャプションに**具体名で登場した**建材・住宅設備・商品・アイテムは、
本文（parts）に書くだけでなく materials 配列に構造化して必ず出力する。

- **メーカー名が無くても、商品名・アイテム名が具体的に挙がっていれば必ず入れる**（maker は空文字でよい）。
  例：「調理台シート」「滑らないハンガー」「スターフィルター」など一般名でも product_name に入れる。
- メーカー名・型番が明記されていれば maker / model_number に入れる。無ければ空文字（**推測しない**）。
- **『N選』『1.〜 2.〜』の列挙がある投稿は、列挙された全アイテムを materials に入れる**
  （このリスト＝施主が興味を持った商品であり、工務店への商談支援データとして最重要）。
- キャプションに具体的な商品・アイテムが1つも出てこない場合のみ materials を空配列にする。
- **存在しないメーカー名・型番を絶対に創作しない。** これは施主に提示される情報であり、誤りは信頼を損なう。

---

### ルール5：体感・暮らし視点の維持

このメディアの核心は「住んだらどう感じるか」。
**知識行（・）の中に**以下の視点を自然に織り込むこと（行動指示としてではなく、気づき・基準として）。

- 実際に住んだときの感覚・気づき
- 後悔しないための比較・チェック視点
- 数値や条件ではなく「体で感じる」描写

※「モデルハウスで体感しよう」といった行動喚起は知識行に書かず、必要なら唯一の「→」行に集約する。

---

### ルール6：ローカル文脈の挿入は控えめに

岡山・倉敷のローカル文脈（「岡山のモデルハウスで確認できます」等）は、
**入れるとしても記事全体で1回まで**、かつ唯一の「→」行に置く。
自然に置けないなら**入れなくてよい**（毎記事に機械的に入れない）。

---

## 📥 入力形式

\\\`\\\`\\\`
【元のキャプション】：{ここにInstagramキャプションが入る}
【元のパーツ数】：{数字}
\\\`\\\`\\\`

---

## 📤 出力形式（各パーツの文字列イメージ）

\\\`\\\`\\\`
【パーツ1タイトル】
・（保存価値のある知識／好み／基準。言い切り型）
・（同上。実質があれば最大3行。無理に増やさない）

【パーツ2タイトル】
・〜
・〜

【パーツ3タイトル】
・〜
→ （記事全体で1回だけ置ける任意のアクション行。不要なら付けない）
\\\`\\\`\\\`

※「→」行は上のように**記事全体で最大1つ**。全パーツには付けない。各パーツの「・」は1〜3行で可変。

- 【カテゴリー】ldk / washroom / toilet / exterior / layout / other から1つ（間取り・動線が主題なら layout）
- 【タグ】家づくり検討者が検索しそうなキーワード3〜5個
- 【materials】キャプションに具体名で出た商品・アイテム（メーカー無しでも商品名で。列挙は全項目。無ければ空）

余計な前置き・挨拶・まとめ文は一切出力しないこと。

---

## ✅ 品質チェック（自己採点）

出力前に以下を自己採点し、合計60点未満の場合は再生成すること。

| 項目 | 配点 | チェック内容 |
|------|------|-------------|
| UIノイズなし | 20点 | アカウント名・タイトルの繰り返しがないか |
| 5秒ルール | 20点 | 各パーツの「・」が1〜3行で簡潔か（水増しが無いか） |
| 体感視点 | 20点 | 「住んだらどう感じるか」の描写が知識行に1つ以上あるか |
| CTA節度 | 20点 | 「→」アクションが**0〜1個に収まっているか**（全パーツに付けて繰り返していないか） |
| 誠実さ | 20点 | 数値・メーカー・型番・効能を**キャプションに無いのに創作していないか** |

---

*バージョン：v1.1 / 最終更新：2026年6月（行数可変・CTA節度・列挙保持・商品名抽出）*

---

## 🚫 出力形式について(JSON構造化出力)

記事は上記のルールに加え、決められたJSONスキーマで出力します。
「生成前チェック」に1つでも該当する場合は、skip: true, skipReason: "理由" を返してください。
その場合は他のフィールド(title / intro / category / tags / parts / scoreInfo)は空で構いません。`;

export const REVISION_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

---
1回目に生成した記事の採点結果、改善が必要な点が指摘されました。
指摘事項を踏まえて記事(title / intro / category / tags / parts)を修正してください。
記事の形式・スキーマは維持し、指摘された箇所を中心に改善してください。
修正後の記事に対しても、同じ基準で自己評価(scoreInfo)を再度出力してください。`;

/** 記事生成時にGeminiへ渡すカルーセル画像の最大枚数(コスト対策) */
const MAX_VISION_IMAGES = 6;

/** Gemini vision が受け付ける画像MIMEタイプ */
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/**
 * この投稿で画像(vision)を使うべきか判定する。コスト最適化(③)。
 * VISION_MODE: always(既定・現状維持) | never | conditional
 * conditional は「キャプション単体で内容が完結している投稿」のみ画像を省く。
 * 例: 「10選」など番号付きで全項目がキャプションにある投稿 → 画像不要。
 *     寸法をテロップでしか出さない投稿(キャプションが短く数値が無い) → 画像必要。
 * 不確実な時は画像を送る(品質を優先)安全側の判定にする。
 */
export function shouldUseVision(caption: string | null | undefined): boolean {
  const mode = process.env.VISION_MODE ?? "always";
  if (mode === "never") return false;
  if (mode !== "conditional") return true; // always(既定)

  const text = (caption ?? "")
    .replace(/[#＃][^\s#＃]+/g, "")
    .replace(/@[^\s]+/g, "")
    .trim();
  const hasEnumeration = /(^|\n)\s*\d+[.．、)]/.test(text) || /\d+\s*選/.test(text);
  const numberCount = (text.match(/\d+/g) ?? []).length;
  const selfSufficient = text.length >= 250 && (hasEnumeration || numberCount >= 4);
  return !selfSufficient;
}

/** 投稿のvision入力に使う画像URL一覧(カルーセル優先、無ければカバー1枚)。 */
export function imageUrlsForPost(post: InstagramPost): string[] {
  return post.carouselUrls?.length
    ? post.carouselUrls
    : post.display_uri
      ? [post.display_uri]
      : [];
}

// ============================================================
// 2026-06-27: 逐次生成パス(Gemini)。2026-06-28にBatchパス(batch.ts/batch-generate.ts)も
// Geminiへ移行し、Anthropic関連のコードは全て撤去した。
// ============================================================

export interface GeminiImagePart {
  inline_data: { mime_type: string; data: string };
}

/** カルーセル画像URLをfetchしてGemini向けinline_dataパーツに変換する(画像取得失敗はスキップ)。 */
export async function fetchGeminiImageParts(urls: string[]): Promise<GeminiImagePart[]> {
  const blocks: GeminiImagePart[] = [];
  for (const url of urls.slice(0, MAX_VISION_IMAGES)) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const rawType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
      const mediaType = SUPPORTED_IMAGE_TYPES.includes(rawType) ? rawType : "image/jpeg";
      const data = Buffer.from(await res.arrayBuffer()).toString("base64");
      blocks.push({ inline_data: { mime_type: mediaType, data } });
    } catch {
      // 1枚の取得失敗は無視して続行
    }
  }
  return blocks;
}

// ArticleSchemaと同じ構造をテキストで明示する(zodOutputFormatのGemini版相当が無いため、
// プロンプトでJSON形状を指示し、受信後にArticleSchema.parse()で検証する)。
const OUTPUT_SCHEMA_PROMPT = `

---
必ず次のJSON形式のみで出力してください(前置き・説明文・コードブロック記法は一切不要、生のJSONのみ):
{
  "skip": false,
  "skipReason": "生成前チェックに該当する場合のみ理由を書く。該当しなければ空文字",
  "title": "記事タイトル(30文字前後)",
  "intro": "導入文(100〜150文字)",
  "category": "ldk・washroom・toilet・exterior・layout・otherのいずれか1つ",
  "tags": ["タグ1", "タグ2"],
  "parts": ["パーツ1の複数行文字列(【小見出し】+「・」知識行)", "パーツ2の複数行文字列"],
  "materials": [
    { "maker": "メーカー名(無ければ空文字、推測しない)", "product_name": "商品名・アイテム名", "model_number": "型番(無ければ空文字、推測しない)", "category": "ldk・washroom・toilet・exterior・layout・otherのいずれか1つ" }
  ],
  "scoreInfo": {
    "articleType": "記事タイプ(自由記述)",
    "fixedScores": { "experience": 0, "specificity": 0, "cta": 0 },
    "dynamicScores": [{ "axis": "動的評価軸名", "score": 0 }],
    "total": 0,
    "improvements": ["改善が必要な箇所の具体的な指摘"]
  }
}
生成前チェックに1つでも該当する場合は skip:true, skipReason:"理由" とし、他のフィールドは空でよい。`;

/**
 * GEN_EFFORT(low/medium/high/max)をモデル世代に応じたthinkingConfigへ読み替える。
 * gemini-2.x系は数値のthinkingBudget、gemini-3.x系は文字列のthinkingLevelを使う
 * (2026-06-27実機検証: gemini-2.5-flashにthinkingLevelを渡すと400エラーになる)。
 */
function buildThinkingConfig(model: string): Record<string, unknown> {
  const effort = (process.env.GEN_EFFORT ?? "").toLowerCase();
  if (model.startsWith("gemini-2.")) {
    const budget = effort === "low" ? 0 : effort === "high" || effort === "max" ? 16384 : 8192;
    return { thinkingBudget: budget };
  }
  const level = effort === "low" ? "low" : effort === "high" || effort === "max" ? "high" : "medium";
  return { thinkingLevel: level };
}

const GEMINI_MAX_OUTPUT_TOKENS = 32768; // thinkingトークンも同じ予算を消費するため十分大きく確保

/**
 * generateContent(逐次)とbatchGenerateContent(Batch、batch.ts)の両方で使う
 * リクエスト本体(systemInstruction/contents/generationConfig)を組み立てる。
 * Batch APIの各リクエストは通常のGenerateContentRequestと同じ形なので、
 * 逐次パスと完全に同じ組み立てロジックを共有できる。
 */
export function buildGeminiRequestBody(
  system: string,
  userPrompt: string,
  images: GeminiImagePart[] = [],
): Record<string, unknown> {
  const model = config.geminiModel;
  const parts: Array<{ text: string } | GeminiImagePart> = [
    { text: userPrompt + OUTPUT_SCHEMA_PROMPT },
    ...images,
  ];
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ parts }],
    generationConfig: {
      thinkingConfig: buildThinkingConfig(model),
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
    },
  };
}

/** Gemini応答の生テキストからArticleWithScoreを抽出・検証する(逐次/Batch共通)。 */
export function parseArticleJsonText(raw: string): ArticleWithScore {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("生成結果のJSON抽出に失敗しました");
  }
  return ArticleSchema.parse(JSON.parse(jsonMatch[0]));
}

/**
 * 2026-06-28: 逐次生成パスはOpenRouter(OpenAI互換chat completions)経由に変更。
 * Google AI Studio無料枠のRPD上限(1日あたり約20回/モデル)を回避するため。
 * モデル自体はvision対応のGeminiを継続使用(画像からの寸法・型番読み取りが必須のため)。
 */
async function requestArticleViaOpenRouter(
  system: string,
  userPrompt: string,
  images: GeminiImagePart[] = [],
): Promise<ArticleWithScore> {
  const model = config.openrouterModel;
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: userPrompt + OUTPUT_SCHEMA_PROMPT },
    ...images.map((img) => ({
      type: "image_url",
      image_url: { url: `data:${img.inline_data.mime_type};base64,${img.inline_data.data}` },
    })),
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openrouterApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter APIエラー (${response.status}): ${errText.slice(0, 500)}`);
  }

  const data = await response.json();
  if (process.env.LOG_USAGE === "true") {
    console.error(`USAGE[${model}] ` + JSON.stringify(data.usage));
  }
  const choice = data.choices?.[0];
  const raw: string = choice?.message?.content ?? "";
  if (!raw || (choice?.finish_reason && choice.finish_reason !== "stop")) {
    throw new Error(`記事の生成に失敗しました (finish_reason: ${choice?.finish_reason ?? "不明"})`);
  }
  return parseArticleJsonText(raw);
}

export function buildUserPrompt(post: InstagramPost, comments: InstagramComment[]): string {
  const commentLines = comments.map((c) => `- @${c.user.username}: ${c.text}`).join("\n");

  return [
    "次のInstagram投稿をもとに記事を作成してください。",
    "添付画像がある場合は、画像内に書かれた寸法・数値・型番・メーカー・商品名を最優先で読み取ること。",
    "",
    "## キャプション",
    post.caption?.text ?? "(キャプションなし)",
    "",
    "## 読者コメント",
    commentLines || "(コメントなし)",
  ].join("\n");
}

/** 1回目のAPI呼び出し: 記事生成 + 自己採点を同時に行う(2026-06-27〜Gemini)。 */
export async function generateAndScore(
  userPrompt: string,
  images: GeminiImagePart[] = [],
): Promise<ArticleWithScore> {
  return requestArticleViaOpenRouter(SYSTEM_PROMPT, userPrompt, images);
}

/** 修正(2回目)用のユーザープロンプトを構築する(逐次/Batch共通)。 */
export function buildRevisionPrompt(userPrompt: string, draft: ArticleWithScore): string {
  return [
    userPrompt,
    "",
    "## 1回目の生成結果(修正前)",
    JSON.stringify(
      {
        title: draft.title,
        intro: draft.intro,
        category: draft.category,
        tags: draft.tags,
        parts: draft.parts,
        materials: draft.materials,
      },
      null,
      2,
    ),
    "",
    "## 採点結果",
    `記事タイプ: ${draft.scoreInfo.articleType}`,
    `合計: ${draft.scoreInfo.total}点 / 100点`,
    "改善が必要な箇所:",
    ...draft.scoreInfo.improvements.map((item) => `- ${item}`),
  ].join("\n");
}

/** 2回目のAPI呼び出し(スコアが低い場合のみ): 採点結果をもとに記事を修正する */
async function reviseArticle(
  userPrompt: string,
  draft: ArticleWithScore,
  images: GeminiImagePart[] = [],
): Promise<ArticleWithScore> {
  return requestArticleViaOpenRouter(REVISION_SYSTEM_PROMPT, buildRevisionPrompt(userPrompt, draft), images);
}

export async function generateArticle(
  post: InstagramPost,
  comments: InstagramComment[],
): Promise<GeneratedArticle> {
  const userPrompt = buildUserPrompt(post, comments);

  // カルーセル画像(最大6枚)をvision入力として取得。画像内の寸法・型番を読み取らせる。
  // VISION_MODE=conditional の場合、キャプションで完結する投稿は画像を省きコスト削減。
  const images = shouldUseVision(post.caption?.text)
    ? await fetchGeminiImageParts(imageUrlsForPost(post))
    : [];
  if (images.length > 0) {
    console.log(`  画像 ${images.length} 枚をvision入力に追加`);
  }

  let result = await generateAndScore(userPrompt, images);

  if (result.skip) {
    return toGeneratedArticle(result);
  }

  const beforeScore = result.scoreInfo.total;
  console.log(`  採点結果: ${result.scoreInfo.total}点/100点 (${result.scoreInfo.articleType})`);

  let revised = false;
  if (result.scoreInfo.total < SCORE_THRESHOLD) {
    console.log(`  スコアが${SCORE_THRESHOLD}点未満のため、修正を実行します。`);
    try {
      result = await reviseArticle(userPrompt, result, images);
      revised = true;
      console.log(`  修正後の採点結果: ${result.scoreInfo.total}点/100点`);
    } catch (err) {
      // Geminiの修正版出力がスキーマ不一致(scoreInfo欠落等)で落ちることがある。
      // 記事を完全に失うより、修正前のdraft(採点済み)を維持して呼び出し元の判断に委ねる。
      console.error(`  修正に失敗したため、修正前の記事を維持します: ${err instanceof Error ? err.message : err}`);
    }
  }

  return toGeneratedArticle(result, revised ? beforeScore : undefined);
}

/** ArticleWithScore(zod出力) を保存用の GeneratedArticle に変換する(逐次/Batch共通)。 */
export function toGeneratedArticle(
  result: ArticleWithScore,
  beforeScore?: number,
): GeneratedArticle {
  return {
    skip: result.skip,
    skipReason: result.skipReason,
    title: result.title,
    intro: result.intro,
    category: result.category,
    tags: result.tags,
    parts: result.parts,
    materials: result.materials,
    scoreInfo: result.scoreInfo,
    beforeScore,
  };
}
