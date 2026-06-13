import { config } from "./config.js";
import type { InstagramComment, InstagramPost } from "./types.js";

const BASE_URL = "https://api.sociavault.com/v1/scrape/instagram";

async function svFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/${path}?${qs}`, {
    headers: { "X-API-Key": config.sociavaultApiKey },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SociaVault API エラー (${res.status}) ${path}: ${body.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

/**
 * SociaVaultはJSON配列を `{"0": ..., "1": ...}` 形式のオブジェクトで返すことがあるため、
 * 配列・オブジェクトどちらでも要素の配列に正規化する。
 */
function toArray<T>(value: T[] | Record<string, T> | undefined | null): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return Object.values(value);
}

/** カルーセル(複数画像)投稿の1スライド分(items[]形式) */
interface RawCarouselItem {
  image_versions2?: { candidates?: { url?: string }[] };
  display_uri?: string;
}

/** ドキュメント記載の data.items[] 形式の投稿アイテム */
interface RawPostItem {
  id: string;
  code: string;
  taken_at: number;
  media_type: number;
  caption?: { text: string } | null;
  like_count?: number;
  comment_count?: number;
  display_uri?: string;
  /** media_type === 8 (カルーセル投稿)の場合のスライド一覧 */
  carousel_media?: RawCarouselItem[] | Record<string, RawCarouselItem>;
}

/** カルーセル画像URLを抽出する。取得できない場合はdisplay_uriの1要素配列にフォールバック */
function carouselUrlsFromRawItem(item: RawPostItem): string[] {
  const urls = toArray(item.carousel_media)
    .map((c) => c.image_versions2?.candidates?.[0]?.url ?? c.display_uri)
    .filter((u): u is string => Boolean(u));
  if (urls.length > 0) {
    return urls;
  }
  return item.display_uri ? [item.display_uri] : [];
}

function fromRawItem(item: RawPostItem): InstagramPost {
  return {
    pk: item.id,
    code: item.code,
    taken_at: item.taken_at,
    media_type: item.media_type,
    caption: item.caption?.text ? { text: item.caption.text } : null,
    like_count: item.like_count,
    comment_count: item.comment_count,
    display_uri: item.display_uri,
    carouselUrls: carouselUrlsFromRawItem(item),
  };
}

/** GraphQL形式(web profile)の投稿ノード */
interface GraphQlPostNode {
  id: string;
  shortcode: string;
  taken_at_timestamp: number;
  is_video?: boolean;
  display_url?: string;
  edge_media_to_caption?: { edges?: { node: { text: string } }[] };
  edge_liked_by?: { count: number };
  edge_media_preview_like?: { count: number };
  edge_media_to_comment?: { count: number };
  /** カルーセル投稿の各スライド(サイドカー) */
  edge_sidecar_to_children?: {
    edges?: { node: { display_url?: string } }[] | Record<string, { node: { display_url?: string } }>;
  };
}

/** カルーセル画像URLを抽出する。取得できない場合はdisplay_urlの1要素配列にフォールバック */
function carouselUrlsFromGraphQlNode(node: GraphQlPostNode): string[] {
  const urls = toArray(node.edge_sidecar_to_children?.edges)
    .map((e) => e.node.display_url)
    .filter((u): u is string => Boolean(u));
  if (urls.length > 0) {
    return urls;
  }
  return node.display_url ? [node.display_url] : [];
}

function fromGraphQlNode(node: GraphQlPostNode): InstagramPost {
  return {
    pk: node.id,
    code: node.shortcode,
    taken_at: node.taken_at_timestamp,
    media_type: node.is_video ? 2 : 1,
    caption: node.edge_media_to_caption?.edges?.[0]?.node.text
      ? { text: node.edge_media_to_caption.edges[0].node.text }
      : null,
    like_count: node.edge_liked_by?.count ?? node.edge_media_preview_like?.count,
    comment_count: node.edge_media_to_comment?.count,
    display_uri: node.display_url,
    carouselUrls: carouselUrlsFromGraphQlNode(node),
  };
}

interface PostsResponse {
  data?: {
    items?: RawPostItem[] | Record<string, RawPostItem>;
    next_max_id?: string;
    more_available?: boolean;
    data?: {
      user?: {
        edge_owner_to_timeline_media?: {
          count?: number;
          edges?: { node: GraphQlPostNode }[] | Record<string, { node: GraphQlPostNode }>;
        };
      };
    };
  };
}

export interface FetchAllPostsOptions {
  /** trueの場合、next_max_idでページネーションして全件取得する */
  fetchAll: boolean;
  /** 取得する投稿数の上限(省略時は上限なし) */
  maxPosts?: number;
  /** 1件取得するごとに呼ばれる進捗コールバック(累計取得件数を渡す) */
  onProgress?: (count: number) => void;
}

/**
 * プロフィールの投稿一覧を取得する。
 * レスポンスは2形式を確認済み:
 * 1. ドキュメント記載の data.items[] 形式(配列 or "0","1",...キーのオブジェクト)。
 *    data.next_max_id / data.more_available でページネーション可能。
 * 2. data.data.user.edge_owner_to_timeline_media.edges[].node のGraphQL形式。
 *    こちらはページネーション非対応のため1ページのみ取得する。
 */
export async function fetchAllPosts(
  handle: string,
  options: FetchAllPostsOptions,
): Promise<InstagramPost[]> {
  const { fetchAll, maxPosts, onProgress } = options;
  const posts: InstagramPost[] = [];
  let nextMaxId: string | undefined;

  for (;;) {
    const params: Record<string, string> = { handle, trim: "true" };
    if (nextMaxId) {
      params.next_max_id = nextMaxId;
    }

    const json = await svFetch<PostsResponse>("posts", params);
    const items = toArray(json.data?.items);

    let pagePosts: InstagramPost[];
    let moreAvailable = false;
    if (items.length) {
      pagePosts = items.map(fromRawItem);
      moreAvailable = Boolean(json.data?.more_available && json.data?.next_max_id);
      nextMaxId = json.data?.next_max_id;
    } else {
      const edges = toArray(json.data?.data?.user?.edge_owner_to_timeline_media?.edges);
      pagePosts = edges.map((e) => fromGraphQlNode(e.node));
    }

    for (const post of pagePosts) {
      posts.push(post);
      onProgress?.(posts.length);
      if (maxPosts && posts.length >= maxPosts) {
        return posts;
      }
    }

    if (!fetchAll || !moreAvailable || pagePosts.length === 0) {
      return posts;
    }
  }
}

/** 投稿のトップレベルコメントを取得(1ページ ≒ 15件) */
export async function fetchComments(postUrl: string): Promise<InstagramComment[]> {
  const json = await svFetch<{
    data?: { comments?: InstagramComment[] | Record<string, InstagramComment> };
  }>("comments", { url: postUrl });
  return toArray(json.data?.comments);
}

export function postUrlFromCode(code: string): string {
  return `https://www.instagram.com/p/${code}/`;
}
