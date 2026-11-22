import { RAW_POSTS, type RawPost } from './posts-data';

export const FEATURED_TAG = '★';

export interface Post {
  /** Verbatim title from the legacy content file. */
  title: string;
  /** Verbatim description HTML from the legacy content file. */
  descriptionHtml: string;
  /** Verbatim tags including the ★ marker where present. */
  tags: string[];
  /** Derived: true when the post carries the ★ featured tag. */
  featured: boolean;
  /** Derived: true when the legacy repo field was '/private'. */
  privateRepo: boolean;
  /**
   * Derived: external repository URL extracted from the legacy repo field
   * (which carried a stray 'portfolio/' prefix), or null when private.
   */
  repoUrl: string | null;
  /** Derived: image file name under public/ (legacy 'portfolio/' prefix stripped). */
  imageFile: string;
}

const stripLegacyPrefix = (value: string): string =>
  value.replace(/^portfolio\//, '');

export function toPost(raw: RawPost): Post {
  const httpIndex = raw.repo.indexOf('http');
  return {
    title: raw.title,
    descriptionHtml: raw.description,
    tags: [...raw.tags],
    featured: raw.tags.includes(FEATURED_TAG),
    privateRepo: raw.repo === '/private',
    repoUrl: httpIndex >= 0 ? raw.repo.slice(httpIndex) : null,
    imageFile: stripLegacyPrefix(raw.image),
  };
}

/** All posts in display order (matches the legacy reversed JSON order). */
export const POSTS: readonly Post[] = RAW_POSTS.map(toPost);

/**
 * Stable, DOM-safe id for a post (titles are unique in the content set). This
 * is the bridge between a pickable 3D book and its accessible DOM card: the
 * scene writes the id into the store, and the DOM overlay/list read it back.
 */
export const postId = (post: Post): string =>
  post.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Resolve a store/DOM post id back to its content record (deep-link safe). */
export const findPostById = (id: string | null): Post | undefined =>
  id ? POSTS.find((post) => postId(post) === id) : undefined;

/** Tags without the ★ marker, for display as chips. */
export const displayTags = (post: Post): string[] =>
  post.tags.filter((tag) => tag !== FEATURED_TAG);

/**
 * Projects shown as game cases on the desk (plan §3.2.3) — a subset of the
 * experience library, keyed by exact post title.
 */
const PROJECT_TITLES: readonly string[] = [
  'DreamZzz - Game Development Project',
  'Interactive Cipher Encoder/Decoder',
  'University of Toronto - Cryptographer',
  'Valorant Agent Guesser',
  'Technology Leadership Initiative - BestFlow',
];

export const PROJECTS: readonly Post[] = POSTS.filter((post) =>
  PROJECT_TITLES.includes(post.title),
);

/** Skills for the About desktop — derived from post tags (plan §3.2.2). */
export const SKILLS: readonly string[] = Array.from(
  new Set(POSTS.flatMap((post) => displayTags(post))),
);
