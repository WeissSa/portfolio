import { describe, expect, it } from 'vitest';
import {
  collectCss,
  escapeHtml,
  fontPreloadFromCss,
  injectCriticalCss,
  injectFontPreload,
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
    expect(result).toContain(
      '<div id="root"><div class="static-mirror"><p>MIRROR</p></div></div>',
    );
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

describe('collectCss', () => {
  it('returns the source of emitted .css assets only', () => {
    expect(
      collectCss({
        'assets/index-hash.css': {
          type: 'asset',
          fileName: 'assets/index-hash.css',
          source: 'body{color:red}',
        },
        'assets/index-hash.js': {
          type: 'chunk',
          fileName: 'assets/index-hash.js',
        },
      }),
    ).toBe('body{color:red}');
  });

  it('returns an empty string when there is no bundle (dev server)', () => {
    expect(collectCss(undefined)).toBe('');
    expect(collectCss({})).toBe('');
  });
});

describe('injectCriticalCss', () => {
  const html =
    '<html><head><link rel="icon" href="/portfolio/favicon.ico"><link rel="stylesheet" crossorigin href="/portfolio/assets/index-hash.css"></head><body></body></html>';

  it('inlines CSS in head and removes the render-blocking stylesheet link', () => {
    const result = injectCriticalCss(html, 'body{color:#fff}');
    expect(result).toContain('<style>body{color:#fff}</style></head>');
    expect(result).not.toContain('rel="stylesheet"');
    expect(result).not.toContain('index-hash.css');
  });

  it('keeps non-stylesheet links (e.g. favicon) intact', () => {
    const result = injectCriticalCss(html, 'a{}');
    expect(result).toContain('<link rel="icon" href="/portfolio/favicon.ico">');
  });

  it('escapes literal </style sequences in the CSS', () => {
    const result = injectCriticalCss(html, 'a::after{content:"</style>"}');
    expect(result).toContain('<style>a::after{content:"<\\/style>"}</style>');
  });

  it('leaves html with no head marker untouched', () => {
    expect(injectCriticalCss('<html><body></body></html>', 'a{}')).toBe(
      '<html><body></body></html>',
    );
  });
});

describe('fontPreloadFromCss / injectFontPreload', () => {
  it('builds a crossorigin font preload from the hashed woff2 URL', () => {
    const css =
      '@font-face{src:url(/portfolio/assets/anton-hash.woff2) format("woff2")}';
    const preload = fontPreloadFromCss(css);
    expect(preload).toBe(
      '<link rel="preload" as="font" type="font/woff2" crossorigin href="/portfolio/assets/anton-hash.woff2">',
    );
    expect(injectFontPreload('<head></head>', preload)).toContain(
      '<head>' + preload + '</head>',
    );
  });

  it('does nothing when there is no font or no preload markup', () => {
    expect(fontPreloadFromCss('body{}')).toBe('');
    expect(injectFontPreload('<head></head>', '')).toBe('<head></head>');
  });
});
