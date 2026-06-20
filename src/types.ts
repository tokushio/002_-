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

/** キャプションに実名で登場した建材・住宅設備・商品(materialsテーブルに保存) */
export interface ExtractedMaterial {
  maker: string;
  product_name: string;
  model_number: string;
  category: string;
}

/**
 * Claudeが生成する記事。
 * Supabaseの実テーブル構造に対応:
 * - articles: title / intro / category / source_tags
 * - article_parts: parts[i] → description (sort_order = i+1)
 * - materials: materials[]( article_id で記事に紐付け )
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
  /** キャプションに実名で出た商品のみ。無ければ空配列 */
  materials: ExtractedMaterial[];
  scoreInfo: ScoreInfo;
  /** 2回目の修正APIを呼んだ場合のみ、修正前のスコアを保持する */
  beforeScore?: number;
}

/**
 * DB(scraping_rulesテーブル)から取得するスクレイピング条件
 */
export interface ScrapingRule {
  id: string;
  name: string;
  target_type: "handle" | "hashtag";
  target_value: string;
  min_likes: number;
  min_comments: number;
  media_types: number[];
  ignore_keywords: string[];
  require_keywords: string[];
  is_active: boolean;
}
