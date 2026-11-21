import { describe, expect, it } from 'vitest';
import { POSTS, PROJECTS, displayTags } from '../src/content/posts';
import { RAW_POSTS } from '../src/content/posts-data';

const EXPECTED_TITLES_IN_ORDER = [
  'Gusto - Software Engineer',
  'Gusto - Software Engineering Intern',
  'Savi Finance - Industry Partnership',
  'Cidel - Software Developer Intern',
  'Valorant Agent Guesser',
  'Technology Leadership Initiative - BestFlow',
  'Paper - Frontend Engineering Intern',
  'University of Toronto - Markus Developer',
  'The Mabin School - Help Ticket Website',
  'University of Toronto - Cryptographer',
  'Code-it Hacks - Python Instruction',
  'Interactive Cipher Encoder/Decoder',
  'DreamZzz - Game Development Project',
];

const EXPECTED_FEATURED_TITLES = [
  'Gusto - Software Engineer',
  'Gusto - Software Engineering Intern',
  'Cidel - Software Developer Intern',
  'Technology Leadership Initiative - BestFlow',
  'Paper - Frontend Engineering Intern',
  'University of Toronto - Markus Developer',
];

describe('posts content schema', () => {
  it('ports all 13 posts verbatim in legacy display order', () => {
    expect(POSTS).toHaveLength(13);
    expect(RAW_POSTS).toHaveLength(13);
    expect(POSTS.map((post) => post.title)).toEqual(EXPECTED_TITLES_IN_ORDER);
  });

  it('keeps every raw field non-empty and copies it verbatim', () => {
    POSTS.forEach((post, index) => {
      const raw = RAW_POSTS[index];
      expect(raw).toBeDefined();
      expect(post.title).toBe(raw?.title);
      expect(post.descriptionHtml).toBe(raw?.description);
      expect(post.descriptionHtml).toMatch(/^<p>[\s\S]*<\/p>$/);
      expect(post.tags).toEqual(raw?.tags);
      expect(post.tags.length).toBeGreaterThan(0);
    });
  });

  it('derives featured flag exactly from the ★ tag', () => {
    const featured = POSTS.filter((post) => post.featured).map(
      (post) => post.title,
    );
    expect(featured.sort()).toEqual([...EXPECTED_FEATURED_TITLES].sort());
    POSTS.forEach((post) => {
      expect(post.featured).toBe(post.tags.includes('★'));
    });
  });

  it('normalizes repo links without losing information', () => {
    POSTS.forEach((post, index) => {
      const raw = RAW_POSTS[index];
      if (raw?.repo === '/private') {
        expect(post.privateRepo).toBe(true);
        expect(post.repoUrl).toBeNull();
      } else {
        expect(post.privateRepo).toBe(false);
        expect(post.repoUrl).toMatch(/^https:\/\/github\.com\//);
        expect(raw?.repo.endsWith(post.repoUrl ?? '\0')).toBe(true);
      }
    });
  });

  it('strips the legacy portfolio/ prefix from image paths', () => {
    POSTS.forEach((post) => {
      expect(post.imageFile).not.toMatch(/^portfolio\//);
      expect(post.imageFile.length).toBeGreaterThan(0);
    });
  });

  it('exposes display tags without the ★ marker', () => {
    POSTS.forEach((post) => {
      expect(displayTags(post)).not.toContain('★');
    });
  });

  it('selects the five game-case projects', () => {
    expect(PROJECTS.map((post) => post.title).sort()).toEqual(
      [
        'DreamZzz - Game Development Project',
        'Interactive Cipher Encoder/Decoder',
        'University of Toronto - Cryptographer',
        'Valorant Agent Guesser',
        'Technology Leadership Initiative - BestFlow',
      ].sort(),
    );
  });
});
