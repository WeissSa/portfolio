import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  injectMirror,
  renderRobots,
  renderSitemap,
  renderStaticMirror,
} from '../scripts/static-mirror';
import { LINKS, POSTS, SEO } from '../src/content/index';

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});

describe('renderStaticMirror', () => {
  const mirror = renderStaticMirror();

  it('contains every post title', () => {
    for (const post of POSTS) {
      expect(mirror).toContain(escapeHtml(post.title));
    }
  });

  it('contains verbatim post description HTML', () => {
    for (const post of POSTS) {
      expect(mirror).toContain(post.descriptionHtml);
    }
  });

  it('marks featured posts with a star', () => {
    expect(mirror).toContain('Gusto - Software Engineer ★');
  });

  it('includes bio, headline, climate statement and contact links', () => {
    expect(mirror).toContain('SWE @ Gusto | HBSc in CS from UofT');
    expect(mirror).toContain(
      'For almost 10 years I have reduced my consumption of fossil fuels',
    );
    expect(mirror).toContain(LINKS.github.url);
    expect(mirror).toContain(LINKS.linkedin.url);
    expect(mirror).toContain('https://open-meteo.com/');
    expect(mirror).toContain(
      'https://www.climatesolutions.ca/climate-defense-fund-ontario',
    );
  });

  it('links hash routes for zero-JS navigation anchors', () => {
    for (const route of [
      '#/about',
      '#/experience',
      '#/projects',
      '#/climate',
    ]) {
      expect(mirror).toContain(`href="${route}"`);
    }
  });

  it('notes private repositories', () => {
    expect(mirror).toContain('Repository is private (NDA).');
  });
});

describe('injectMirror', () => {
  it('fills the empty root container exactly once', () => {
    const html =
      '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>';
    const result = injectMirror(html, '<p>MIRROR</p>');
    expect(result).toContain('<div id="root"><p>MIRROR</p></div>');
    expect(result).not.toContain('<div id="root"></div>');
  });

  it('leaves html without the marker untouched', () => {
    const html = '<html><body><main></main></body></html>';
    expect(injectMirror(html, '<p>MIRROR</p>')).toBe(html);
  });
});

describe('renderSitemap', () => {
  it('is a valid urlset for the site root', () => {
    const xml = renderSitemap('2026-11-21');
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(`<loc>${SEO.siteUrl}</loc>`);
    expect(xml).toContain('<lastmod>2026-11-21</lastmod>');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
  });
});

describe('renderRobots', () => {
  it('allows all crawlers and references the sitemap', () => {
    const robots = renderRobots();
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain(`Sitemap: ${SEO.siteUrl}sitemap.xml`);
  });
});
