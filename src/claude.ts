import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { config } from "./config.js";
import type { GeneratedArticle, InstagramComment, InstagramPost } from "./types.js";

/** スコアが この点未満の場合のみ、2回目の修正APIを呼ぶ(100点満点) */
const SCORE_THRESHOLD = 80;

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
      .describe("CTA(0〜20点)。モデルハウス訪問・スクラップなど次のアクションを促しているか"),
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
    .describe("メーカー・ブランド名(例: TOTO / LIXIL / Panasonic)。キャプション本文に実名で明記がある場合のみ"),
  product_name: z
    .string()
    .describe("商品名・シリーズ名。明記がある場合のみ。無ければ空文字"),
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
        "・2〜4行目: 「・」で始まる“保存価値のある知識行”を2〜3行。住んだ後の気づき・施主の好み・選び方の基準を、" +
        "単体で読んで意味が通る言い切り型で書く。「〜しよう」「〜で確認」「おすすめ」等のTODO・CTA表現は入れない。\n" +
        "・最終行: 「→」で始まる“確認/体感アクション行”を1行だけ。モデルハウスや店頭で確かめる行動。\n" +
        "①②③などの番号は一切使わない。",
    ),
  materials: z
    .array(MaterialSchema)
    .default([])
    .describe(
      "キャプション本文に実名で登場した建材・住宅設備・商品のみを構造化した配列。" +
        "1つも明記がなければ空配列([])にする。メーカー名や型番を推測して埋めることは固く禁止する。",
    ),
  scoreInfo: ScoreInfoSchema.describe("生成した記事に対する自己評価"),
});

type ArticleWithScore = z.infer<typeof ArticleSchema>;

const SYSTEM_PROMPT = `# 記事生成ルール v1.0
## 岡山の家づくり体感まとめ — コンテンツディレクター指示書

---

## あなたの役割

あなたは「岡山の家づくり体感まとめ」アプリのコンテンツディレクターです。
全国の住宅・インテリア系Instagramキャプションを元に、
岡山・倉敷エリアで家づくりを検討する30〜40代施主向けに
**スマートフォンで5秒で読めるノウハウ記事**を生成します。

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
- 1パーツの構成：**【タイトル】＋【箇条書き①②③】のみ**
- 接続詞・前置き・まとめ文は極限まで削る
- 体言止めを積極的に使う

---

### ルール3：パーツ数のルール

| 条件 | 対応 |
|------|------|
| 元の記事が1〜2パーツ | **最低3パーツになるよう補完**（元の内容を深掘りして追加） |
| 元の記事が3〜6パーツ | **そのまま維持**（増減しない） |
| 元の記事が7パーツ以上 | **重要度順に6パーツに絞る** |

---

### ルール4：箇条書きの構成ルール（保存価値の分離）

各パーツは「保存できる知識行（・）」と「保存できないアクション行（→）」を明確に分けて出力する。
番号（①②③）は一切使わない。説明ラベル（「リスク：」等）も付けない。

| 記号 | 役割 | 行数 | 内容 |
|------|------|------|------|
| **・** | 保存対象（知識・好み・基準） | 2〜3行 | 単体で読んで意味が通る「住んだ後の気づき」「施主の好み」「選び方の基準」。**言い切り型**。 |
| **→** | 保存対象外（アクション） | 1行（最後に1つ） | モデルハウス・店頭で体感／確認する行動。 |

**「・」の行に入れてはいけない表現（これらは必ず「→」へ）：**
「〜しよう」「〜で確認」「チェックしよう」「おすすめ」「体感しよう」などのTODO・CTA・行動指示。

❌ 悪い例（保存しても意味が残らない）：
・店頭でクッション性や厚みを実際に触って確認するのがおすすめ
✅ 良い例（保存すると好み・基準として残る）：
・クッション性タイプは食器に優しく、防虫・滑り止め効果もある

数値・型番・メーカー名は**元のキャプションに明記がある場合のみ**使う。無い場合に推測・捏造することを固く禁止する。

---

### ルール4.5：商品・メーカー・型番の構造化抽出（materials）

キャプション本文に**実名で登場した**建材・住宅設備・商品（例：メーカー名・シリーズ名・品番）は、
本文（parts）に書くだけでなく materials 配列に構造化して必ず出力する。

- メーカー名・型番が明記されていれば maker / model_number に入れる。
- 商品名のみで型番が無ければ model_number は空文字にする（**推測しない**）。
- キャプションに具体的な商品が1つも出てこない場合は materials を空配列にする。
- **存在しないメーカー名・型番を絶対に創作しない。** これは施主に提示される情報であり、誤りは信頼を損なう。

---

### ルール5：体感・暮らし視点の維持

このメディアの核心は「住んだらどう感じるか」。
以下の視点を必ず1つ以上のパーツに含めること。

- 実際に住んだときの感覚・気づき
- モデルハウスで体感すべきポイント
- 後悔しないための比較・チェック視点
- 数値や条件ではなく「体で感じる」描写

---

### ルール6：ローカル文脈の自然な挿入

キャプションの内容が岡山・倉敷エリアに関係なくても、
以下のように自然にローカル文脈を加えること。

- 「岡山・倉敷のモデルハウスで確認できます」
- 「岡山エリアで人気のスタイルです」
- 強引な挿入はしない。1記事に1回まで。

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
・（同上）
→ （モデルハウス・店頭で確認する行動。1行のみ）

【パーツ2タイトル】
・〜
・〜
→ 〜

（以降、ルール3で定めたパーツ数まで繰り返す）
\\\`\\\`\\\`

- 【カテゴリー】ldk / washroom / toilet / exterior / layout / other から1つ（間取り・動線が主題なら layout）
- 【タグ】家づくり検討者が検索しそうなキーワード3〜5個
- 【materials】キャプションに実名で出た商品のみ（無ければ空）

余計な前置き・挨拶・まとめ文は一切出力しないこと。

---

## ✅ 品質チェック（自己採点）

出力前に以下を自己採点し、合計60点未満の場合は再生成すること。

| 項目 | 配点 | チェック内容 |
|------|------|-------------|
| UIノイズなし | 20点 | アカウント名・タイトルの繰り返しがないか |
| 5秒ルール | 20点 | 各パーツが箇条書き3行に収まっているか |
| 体感視点 | 20点 | 「住んだらどう感じるか」の描写が1つ以上あるか |
| CTA | 20点 | 最後のパーツにモデルハウス訪問・体感を促す行動があるか |
| 数値の誠実さ | 20点 | 数値を捏造していないか |

---

*バージョン：v1.0 / 最終更新：2026年6月*

---

## 🚫 出力形式について(JSON構造化出力)

記事は上記のルールに加え、決められたJSONスキーマで出力します。
「生成前チェック」に1つでも該当する場合は、skip: true, skipReason: "理由" を返してください。
その場合は他のフィールド(title / intro / category / tags / parts / scoreInfo)は空で構いません。`;

const REVISION_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

---
1回目に生成した記事の採点結果、改善が必要な点が指摘されました。
指摘事項を踏まえて記事(title / intro / category / tags / parts)を修正してください。
記事の形式・スキーマは維持し、指摘された箇所を中心に改善してください。
修正後の記事に対しても、同じ基準で自己評価(scoreInfo)を再度出力してください。`;

let client: Anthropic | undefined;

export function buildUserPrompt(post: InstagramPost, comments: InstagramComment[]): string {
  const commentLines = comments.map((c) => `- @${c.user.username}: ${c.text}`).join("\n");

  return [
    "次のInstagram投稿をもとに記事を作成してください。",
    "",
    "## キャプション",
    post.caption?.text ?? "(キャプションなし)",
    "",
    "## 読者コメント",
    commentLines || "(コメントなし)",
  ].join("\n");
}

async function requestArticle(system: string, userPrompt: string): Promise<ArticleWithScore> {
  client ??= new Anthropic({ apiKey: config.anthropicApiKey });

  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content: userPrompt }],
    output_config: { format: zodOutputFormat(ArticleSchema) },
  });

  const result = response.parsed_output;
  if (!result) {
    throw new Error(`記事の生成に失敗しました (stop_reason: ${response.stop_reason})`);
  }
  return result;
}

/** 1回目のAPI呼び出し: 記事生成 + 自己採点を同時に行う */
export async function generateAndScore(userPrompt: string): Promise<ArticleWithScore> {
  return requestArticle(SYSTEM_PROMPT, userPrompt);
}

/** 2回目のAPI呼び出し(スコアが低い場合のみ): 採点結果をもとに記事を修正する */
async function reviseArticle(
  userPrompt: string,
  draft: ArticleWithScore,
): Promise<ArticleWithScore> {
  const revisionPrompt = [
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

  return requestArticle(REVISION_SYSTEM_PROMPT, revisionPrompt);
}

export async function generateArticle(
  post: InstagramPost,
  comments: InstagramComment[],
): Promise<GeneratedArticle> {
  const userPrompt = buildUserPrompt(post, comments);

  let result = await generateAndScore(userPrompt);

  if (result.skip) {
    return {
      skip: true,
      skipReason: result.skipReason,
      title: result.title,
      intro: result.intro,
      category: result.category,
      tags: result.tags,
      parts: result.parts,
      materials: result.materials,
      scoreInfo: result.scoreInfo,
    };
  }

  const beforeScore = result.scoreInfo.total;
  console.log(`  採点結果: ${result.scoreInfo.total}点/100点 (${result.scoreInfo.articleType})`);

  let revised = false;
  if (result.scoreInfo.total < SCORE_THRESHOLD) {
    console.log(`  スコアが${SCORE_THRESHOLD}点未満のため、修正を実行します。`);
    result = await reviseArticle(userPrompt, result);
    revised = true;
    console.log(`  修正後の採点結果: ${result.scoreInfo.total}点/100点`);
  }

  return {
    skip: false,
    title: result.title,
    intro: result.intro,
    category: result.category,
    tags: result.tags,
    parts: result.parts,
    materials: result.materials,
    scoreInfo: result.scoreInfo,
    beforeScore: revised ? beforeScore : undefined,
  };
}
