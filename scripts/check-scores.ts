import { config } from "../src/config.js";
import { buildUserPrompt, generateAndScore } from "../src/claude.js";
import { fetchAllPosts, fetchComments, postUrlFromCode } from "../src/sociavault.js";
import type { InstagramComment } from "../src/types.js";

const TARGET_CODES = ["DZMzfL4jFmI", "DZH0Nmkkrms", "DZFS-DnDWT5"];

const posts = await fetchAllPosts(config.instagramHandle, { fetchAll: false, maxPosts: 6 });
const targets = posts.filter((p) => TARGET_CODES.includes(p.code));

for (const post of targets) {
  const url = postUrlFromCode(post.code);
  let comments: InstagramComment[] = [];
  try {
    comments = await fetchComments(url);
  } catch {
    // コメント取得失敗時は空配列で継続
  }

  const userPrompt = buildUserPrompt(post, comments);
  const result = await generateAndScore(userPrompt);
  const s = result.scoreInfo;

  console.log("================================================");
  console.log(`タイトル: ${result.title}`);
  console.log(`articleType: ${s.articleType}`);
  console.log(`固定3軸: experience=${s.fixedScores.experience} / specificity=${s.fixedScores.specificity} / cta=${s.fixedScores.cta}`);
  console.log(`動的軸: ${s.dynamicScores.map((d) => `${d.axis}=${d.score}`).join(", ")}`);
  console.log(`total: ${s.total}`);
  console.log("improvements:");
  for (const item of s.improvements) {
    console.log(`  - ${item}`);
  }
}
