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

const ArticleSchema = z.object({
  skip: z
    .boolean()
    .default(false)
    .describe("生成前チェックに1つでも該当し、記事を生成しない場合はtrue"),
  skipReason: z.string().optional().describe("skipがtrueの場合、該当した理由"),
  title: z.string().describe("記事タイトル(30文字前後、検索を意識した自然な日本語)"),
  intro: z.string().describe("導入文(100〜150文字。記事の要点を伝えるリード)"),
  category: z.string().describe("記事カテゴリ(短い日本語1語〜2語。例: 子育て、レシピ、住まい)"),
  tags: z.array(z.string()).describe("記事タグ(3〜6個。短い日本語)"),
  parts: z
    .array(z.string())
    .describe(
      "記事本文のセクション配列(3〜6個)。各セクションは200〜400文字のまとまった段落。" +
        "先頭に【見出し】の形でそのセクションの小見出しを付ける。",
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

### ルール4：箇条書きの構成ルール

各パーツは以下の順番で**3行のみ**出力すること。
説明的なラベル（「リスク：」「解決策：」など）は一切付けない。

| 行 | 内容 |
|----|------|
| **①** | そのパーツが伝える「核心的な価値」または「見落としがちな盲点・リスク」 |
| **②** | 実現・解決・判断するための「具体的な数値・条件・基準・理由」。**元の記事に数値がない場合は「モデルハウスで実際に体感して確認すべきポイント」に置き換える。数値は絶対に捏造しない。** |
| **③** | ユーザーが次に選ぶべき「具体的な行動・選択肢・チェック方法」 |

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

## 📤 出力形式

\\\`\\\`\\\`
【タイトル】（30文字以内・施主の指が止まるタイトル）

【パーツ1タイトル】
① （核心的な価値 or 盲点・リスク）
② （具体的な数値・条件・基準 / または体感確認ポイント）
③ （次の具体的な行動・選択肢）

【パーツ2タイトル】
① 〜
② 〜
③ 〜

（以降、ルール3で定めたパーツ数まで繰り返す）

【カテゴリー】ldk / washroom / toilet / exterior / other から1つ
【タグ】家づくり検討者が検索しそうなキーワード3〜5個（#なし、カンマ区切り）
\\\`\\\`\\\`

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
    scoreInfo: result.scoreInfo,
    beforeScore: revised ? beforeScore : undefined,
  };
}
