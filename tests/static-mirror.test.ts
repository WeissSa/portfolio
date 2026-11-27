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
  staticMirrorPlugin,
  stripStaticCriticalCss,
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

  it('carries the full CC BY 4.0 Open-Meteo attribution with both links', () => {
    expect(mirror).toContain(
      'Weather data by <a href="https://open-meteo.com/"',
    );
    expect(mirror).toContain('https://creativecommons.org/licenses/by/4.0/');
    expect(mirror).toContain('CC BY 4.0');
    expect(mirror).toContain('values rounded');
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

  it('dedupes the hand-authored static critical style in the build', () => {
    const withStatic = html.replace(
      '</head>',
      '<style data-critical-mirror>.static-mirror{color:#fff}</style></head>',
    );
    const result = injectCriticalCss(withStatic, 'body{background:#000}');
    // Exactly one effective inline style: the full built CSS, not the static
    // block plus a second copy of the same mirror rules.
    expect(result.match(/<style\b/gi)).toHaveLength(1);
    expect(result).toContain('<style>body{background:#000}</style>');
    expect(result).not.toContain('data-critical-mirror');
  });
});

describe('stripStaticCriticalCss', () => {
  it('removes the marked static style block and nothing else', () => {
    const html =
      '<head><style data-critical-mirror>.static-mirror{color:#fff}</style><link rel="icon" href="/favicon.ico"><style>.live{color:red}</style></head>';
    const result = stripStaticCriticalCss(html);
    expect(result).not.toContain('data-critical-mirror');
    expect(result).not.toContain('.static-mirror{color:#fff}');
    expect(result).toContain('<link rel="icon" href="/favicon.ico">');
    expect(result).toContain('<style>.live{color:red}</style>');
  });

  it('is a no-op when there is no static critical block (dev already clean)', () => {
    const html = '<head><link rel="icon" href="/favicon.ico"></head>';
    expect(stripStaticCriticalCss(html)).toBe(html);
  });
});

describe('staticMirrorPlugin().transformIndexHtml', () => {
  const plugin = staticMirrorPlugin();

  type Bundle = Record<
    string,
    { type: string; fileName: string; source?: string }
  >;
  type TransformHandler = (html: string, ctx: { bundle?: Bundle }) => string;

  function handler(): TransformHandler {
    const hook = plugin.transformIndexHtml;
    if (!hook || typeof hook === 'function') {
      throw new Error('expected object-form transformIndexHtml hook');
    }
    return ('handler' in hook
      ? hook.handler
      : hook.transform) as unknown as TransformHandler;
  }

  const devHtml = [
    '<html><head>',
    '<style data-critical-mirror>.static-mirror{color:#fff}</style>',
    '</head><body><div id="root"></div></body></html>',
  ].join('');

  it('build: strips stylesheet link + static block and inlines full CSS', () => {
    const html = devHtml.replace(
      '</head>',
      '<link rel="stylesheet" href="/portfolio/assets/index.css"></head>',
    );
    const result = handler()(html, {
      bundle: {
        'assets/index.css': {
          type: 'asset',
          fileName: 'assets/index.css',
          source: '.static-mirror h1{color:red}body{background:#000}',
        },
      },
    });
    expect(result).toContain(
      '<style>.static-mirror h1{color:red}body{background:#000}</style>',
    );
    expect(result).not.toContain('rel="stylesheet"');
    expect(result).not.toContain('data-critical-mirror');
    expect(result).toContain('<div id="root"><div class="static-mirror">');
  });

  it('dev (no bundle): keeps the static critical style and injects the mirror', () => {
    const result = handler()(devHtml, {});
    expect(result).toContain(
      '<style data-critical-mirror>.static-mirror{color:#fff}</style>',
    );
    expect(result).toContain('<div id="root"><div class="static-mirror">');
    expect(result).not.toContain('<style>body{');
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

  it('strips surrounding CSS quotes so the preload href does not 404', () => {
    const doubleQuoted =
      '@font-face{src:url("/portfolio/assets/anton-hash.woff2") format("woff2")}';
    const preload = fontPreloadFromCss(doubleQuoted);
    expect(preload).toBe(
      '<link rel="preload" as="font" type="font/woff2" crossorigin href="/portfolio/assets/anton-hash.woff2">',
    );
    expect(preload).not.toContain('%22');
    const singleQuoted =
      "@font-face{src:url('/portfolio/assets/anton-hash.woff2') format('woff2')}";
    expect(fontPreloadFromCss(singleQuoted)).toBe(preload);
  });

  it('escapes the font href so CSS cannot break out of the attribute', () => {
    const css = '@font-face{src:url(a"&b.woff2) format("woff2")}';
    const preload = fontPreloadFromCss(css);
    expect(preload).toContain('href="a%22&amp;b.woff2"');
    expect((preload.match(/href="/g) ?? []).length).toBe(1);
  });

  it('does nothing when there is no font or no preload markup', () => {
    expect(fontPreloadFromCss('body{}')).toBe('');
    expect(injectFontPreload('<head></head>', '')).toBe('<head></head>');
  });
});
