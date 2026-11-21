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
    `<section aria-label="Climate"><h2>${escapeHtml(CLIMATE_TITLE)}</h2><p>${escapeHtml(CLIMATE_STATEMENT)}</p><h3>${escapeHtml(TODAY_WIDGET_TITLE)}</h3><p>Live comparison of today's temperature in ${escapeHtml(CLIMATE_LOCATION.name)} against the last-30-years historical mean, plus a historical heatmap with a year selector (interactive version).</p><h3>Legend</h3><ul>${HEATMAP_LEGEND.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p>${escapeHtml(CLIMATE_ATTRIBUTION.weatherProviderLabel)} <a href="${CLIMATE_ATTRIBUTION.openMeteo.url}" rel="noopener noreferrer">${escapeHtml(CLIMATE_ATTRIBUTION.openMeteo.label)}</a></p><p>${escapeHtml(CLIMATE_ATTRIBUTION.supportLabel)} <a href="${CLIMATE_ATTRIBUTION.climateDefenseFund.url}" rel="noopener noreferrer">${escapeHtml(CLIMATE_ATTRIBUTION.climateDefenseFund.label)}</a></p></section>`,
    `<footer><h2>Contact</h2><ul><li><a href="${LINKS.github.url}" rel="noopener noreferrer">${escapeHtml(LINKS.github.label)}</a></li><li><a href="${LINKS.linkedin.url}" rel="noopener noreferrer">${escapeHtml(LINKS.linkedin.label)}</a></li></ul></footer>`,
  ].join('\n');
}

/** Replace #root's (empty) contents with the static mirror. */
export function injectMirror(
  html: string,
  mirror = renderStaticMirror(),
): string {
  return html.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${mirror}</div>`,
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
      handler(html) {
        return injectMirror(html);
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
