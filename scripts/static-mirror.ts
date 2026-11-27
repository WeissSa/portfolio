/**
 * Build-time static content mirror (REWORK_PLAN §4.5/§4.6):
 * injects the full site content into dist/index.html (SEO + zero-JS
 * usability — React replaces #root's children on boot) and emits
 * sitemap.xml + robots.txt.
 *
 * Pure render functions are exported for unit tests; the Vite plugin below
 * wires them into the build.
 */
import type { Plugin } from 'vite';
import {
  BIO_PARAGRAPH,
  CLIMATE_ATTRIBUTION,
  CLIMATE_LOCATION,
  CLIMATE_STATEMENT,
  CLIMATE_TITLE,
  HEADLINE,
  HEATMAP_LEGEND,
  HOBBIES_EXCERPT,
  LINKS,
  NOW_EXCERPTS,
  POSTS,
  SEO,
  SITE_OWNER,
  TODAY_WIDGET_TITLE,
  WELCOME_TITLE,
  displayTags,
} from '../src/content/index';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Minimal structural view of a Rollup/Vite emitted asset used below. */
type EmittedAsset = {
  type: string;
  fileName: string;
  source?: string | Uint8Array;
};

/**
 * Concatenate the source of every emitted `.css` asset from the build bundle.
 * `bundle` is undefined outside a build (dev server). In dev, app CSS is
 * injected from JS (main.tsx), so we skip build-style inlining and rely on the
 * hand-authored `<style data-critical-mirror>` block shipped in index.html to
 * style the static mirror on the very first paint (no JS / network needed).
 */
export function collectCss(
  bundle: Record<string, EmittedAsset> | undefined,
): string {
  if (!bundle) return '';
  return Object.values(bundle)
    .filter(
      (item) =>
        item.type === 'asset' &&
        typeof item.source === 'string' &&
        item.fileName.endsWith('.css'),
    )
    .map((item) => item.source as string)
    .join('\n');
}

/**
 * Remove the hand-authored `<style data-critical-mirror>` block from the source
 * index.html. The built CSS bundle already carries the very same mirror rules
 * (imported via src/styles/index.css → static-mirror.css), so leaving the dev
 * block in place would duplicate every mirror rule in the built HTML.
 *
 * DEDUPE CHOICE: strip the small static block and inline the FULL built CSS.
 * The result is exactly one effective inline style in dist/index.html, with
 * the complete on-brand styling; dev (no bundle) keeps the static block.
 */
export function stripStaticCriticalCss(html: string): string {
  return html.replace(
    /<style\b[^>]*\bdata-critical-mirror\b[^>]*>[\s\S]*?<\/style\s*>/gi,
    '',
  );
}

/**
 * Remove Vite's render-blocking `<link rel="stylesheet" ... .css>` and put the
 * built CSS in an inline `<style>` in <head>, so the build-time static mirror
 * is styled on the very first paint with zero network round trips. The emitted
 * CSS file is left in place (harmless: no page references it) so other HTML
 * entry points keep working and size-limit accounting is unchanged.
 *
 * Also strips the dev-only static critical block so the built page never ends
 * up with two inline style blocks / duplicate mirror rules.
 */
export function injectCriticalCss(html: string, css: string): string {
  // Guard BEFORE touching any markup: without a </head> there is nowhere to
  // place the inline style, and dropping the stylesheet link would leave the
  // page completely unstyled.
  if (!/<\/head>/i.test(html)) return html;

  const withoutCssLink = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const isStylesheet =
      /\brel\s*=\s*(?:"stylesheet"|'stylesheet'|stylesheet(?:\s|>|$))/i.test(
        tag,
      );
    const isCssHref =
      /\bhref\s*=\s*(?:"[^"]*\.css(?:\?[^"]*)?"|'[^']*\.css(?:\?[^']*)?')/i.test(
        tag,
      );
    return isStylesheet && isCssHref ? '' : tag;
  });

  // Dedupe: remove the source `<style data-critical-mirror>` before inlining
  // the full bundle CSS (see stripStaticCriticalCss for the rationale).
  const deduped = stripStaticCriticalCss(withoutCssLink);

  // Escape any literal `</style` in the CSS so it cannot close the block early
  // (`\/` is a valid CSS escape for `/`, so the declaration stays intact).
  const safeCss = css.replace(/<\/style/gi, '<\\/style');
  return deduped.replace(/<\/head>/i, `<style>${safeCss}</style></head>`);
}

/**
 * Build a font preload tag from the first hashed `.woff2` URL in the built CSS.
 * The Anton subset already declares `font-display: swap`; this only makes the
 * (secondary) font swap start a little earlier — it is unrelated to the raw
 * HTML flash, which the inline CSS eliminates.
 */
export function fontPreloadFromCss(css: string): string {
  // Tolerate quoted and unquoted url() forms; capture only the URL itself so
  // surrounding CSS quotes are never percent-encoded into the preload href
  // (`url("font.woff2")` must not preload `%22font.woff2%22` → 404).
  const match = /url\(\s*(["']?)([^)]*?\.woff2)\1\s*\)/i.exec(css);
  if (!match) return '';
  // The URL is interpolated into an HTML attribute: percent-encode it, then
  // escape HTML-significant characters so a quote in the CSS cannot break out
  // of the href (e.g. `url("x\").woff2")` must not inject a new attribute).
  const href = escapeHtml(encodeURI((match[2] ?? '').trim()));
  return `<link rel="preload" as="font" type="font/woff2" crossorigin href="${href}">`;
}

export function injectFontPreload(html: string, preload: string): string {
  if (!preload || !/<head\b[^>]*>/i.test(html)) return html;
  return html.replace(/(<head\b[^>]*>)/i, `$1${preload}`);
}

function renderPost(post: (typeof POSTS)[number]): string {
  const tags = displayTags(post)
    .map((tag) => `<li>${escapeHtml(tag)}</li>`)
    .join('');
  const link = post.repoUrl
    ? `<p><a href="${escapeHtml(post.repoUrl)}" rel="noopener noreferrer">Repository</a></p>`
    : '<p>Repository is private (NDA).</p>';
  return [
    '<article>',
    `<h3>${escapeHtml(post.title)}${post.featured ? ' ★' : ''}</h3>`,
    // Trusted verbatim HTML ported from the legacy content file.
    post.descriptionHtml,
    link,
    `<ul aria-label="Tags for ${escapeHtml(post.title)}">${tags}</ul>`,
    '</article>',
  ].join('');
}

/** Full static mirror of all site content, injected into #root at build. */
export function renderStaticMirror(): string {
  const posts = POSTS.map(renderPost).join('\n');
  return [
    '<noscript><p>This portfolio is fully readable without JavaScript; the interactive version requires it.</p></noscript>',
    `<header><h1>${escapeHtml(SITE_OWNER)}</h1><p>${escapeHtml(HEADLINE)}</p></header>`,
    `<nav aria-label="Main"><ul><li><a href="#/">Home</a></li><li><a href="#/about">About</a></li><li><a href="#/experience">Experience</a></li><li><a href="#/projects">Projects</a></li><li><a href="#/climate">Climate</a></li></ul></nav>`,
    `<section aria-label="About"><h2>${escapeHtml(WELCOME_TITLE)}</h2><p>${escapeHtml(BIO_PARAGRAPH)}</p><h3>Now</h3>${NOW_EXCERPTS.map((excerpt) => `<p>${escapeHtml(excerpt)}</p>`).join('')}<h3>Hobbies</h3><p>${escapeHtml(HOBBIES_EXCERPT)}</p></section>`,
    `<section aria-label="Experience"><h2>Experience &amp; Projects</h2>\n${posts}\n</section>`,
    `<section aria-label="Climate"><h2>${escapeHtml(CLIMATE_TITLE)}</h2><p>${escapeHtml(CLIMATE_STATEMENT)}</p><h3>${escapeHtml(TODAY_WIDGET_TITLE)}</h3><p>Live comparison of today's temperature in ${escapeHtml(CLIMATE_LOCATION.name)} against the last-30-years historical mean, plus a historical heatmap with a year selector (interactive version).</p><h3>Legend</h3><ul>${HEATMAP_LEGEND.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p>${escapeHtml(CLIMATE_ATTRIBUTION.weatherProviderLabel)} <a href="${CLIMATE_ATTRIBUTION.openMeteo.url}" rel="noopener noreferrer">${escapeHtml(CLIMATE_ATTRIBUTION.openMeteo.label)}</a> (<a href="${CLIMATE_ATTRIBUTION.license.url}" rel="noopener noreferrer">${escapeHtml(CLIMATE_ATTRIBUTION.license.label)}</a>) ${escapeHtml(CLIMATE_ATTRIBUTION.roundedNote)}</p><p>${escapeHtml(CLIMATE_ATTRIBUTION.supportLabel)} <a href="${CLIMATE_ATTRIBUTION.climateDefenseFund.url}" rel="noopener noreferrer">${escapeHtml(CLIMATE_ATTRIBUTION.climateDefenseFund.label)}</a></p></section>`,
    `<footer><h2>Contact</h2><ul><li><a href="${LINKS.github.url}" rel="noopener noreferrer">${escapeHtml(LINKS.github.label)}</a></li><li><a href="${LINKS.linkedin.url}" rel="noopener noreferrer">${escapeHtml(LINKS.linkedin.label)}</a></li></ul></footer>`,
  ].join('\n');
}

/** Replace #root's (empty) contents with the static mirror. */
export function injectMirror(
  html: string,
  mirror = renderStaticMirror(),
): string {
  // The wrapper is scoped styling for the mirror only. React's createRoot
  // replaces all of #root's children on boot, so these styles vanish with the
  // mirror and never touch the interactive UI.
  return html.replace(
    /<div id="root"><\/div>/,
    `<div id="root"><div class="static-mirror">${mirror}</div></div>`,
  );
}

export function renderSitemap(lastmod: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${SEO.siteUrl}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    '  </url>',
    '</urlset>',
    '',
  ].join('\n');
}

export function renderRobots(): string {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${SEO.siteUrl}sitemap.xml`,
    '',
  ].join('\n');
}

export function staticMirrorPlugin(): Plugin {
  return {
    name: 'static-content-mirror',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const mirrored = injectMirror(html);
        // In Vite 5 the post hook receives the build bundle with the emitted
        // CSS asset already present, so this runs after Vite injects its
        // render-blocking <link> and we can safely replace it with inline CSS.
        const css = collectCss(ctx?.bundle);
        if (!css) return mirrored;
        return injectFontPreload(
          injectCriticalCss(mirrored, css),
          fontPreloadFromCss(css),
        );
      },
    },
    generateBundle() {
      const lastmod = new Date().toISOString().split('T')[0] ?? '';
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: renderSitemap(lastmod),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: renderRobots(),
      });
    },
  };
}
