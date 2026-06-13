/** SociaVault Instagram投稿(必要フィールドのみ) */
export interface InstagramPost {
  pk: string;
  code: string; // shortcode → https://www.instagram.com/p/{code}/
  taken_at: number; // Unixタイムスタンプ
  media_type: number; // 2 = 動画/リール
  caption: { text: string } | null;
  like_count?: number;
  comment_count?: number;
  display_uri?: string; // サムネイル画像URL(レスポンスにより欠落あり)
  /** カルーセル(複数画像)投稿の各画像URL。1枚のみの投稿はdisplay_uriの1要素配列 */
  carouselUrls?: string[];
}

/** SociaVault Instagramコメント(必要フィールドのみ) */
export interface InstagramComment {
  id: string;
  text: string;
  created_at: number;
  user: { username: string; is_verified?: boolean };
}

/** Claudeによる記事の自己評価 */
export interface ScoreInfo {
  articleType: string;
  fixedScores: {
    experience: number;
    specificity: number;
    cta: number;
  };
  dynamicScores: { axis: string; score: number }[];
  total: number;
  improvements: string[];
}

/**
 * Claudeが生成する記事。
 * Supabaseの実テーブル構造に対応:
 * - articles: title / intro / category / source_tags
 * - article_parts: parts[i] → description (sort_order = i+1)
 */
export interface GeneratedArticle {
  /** 生成前チェックに該当し記事を生成しなかった場合はtrue */
  skip: boolean;
  /** skipがtrueの場合、該当した理由 */
  skipReason?: string;
  title: string;
  intro: string;
  category: string;
  tags: string[];
  parts: string[];
  scoreInfo: ScoreInfo;
  /** 2回目の修正APIを呼んだ場合のみ、修正前のスコアを保持する */
  beforeScore?: number;
}
