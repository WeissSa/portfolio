/**
 * In-world detail textures (plan polish(c), owner decision 2026-11-24).
 *
 * The detail a visitor used to see in a DOM dialog is painted as a CanvasTexture
 * onto 3D planes: book pages, a lifted case's content card, the CRT screen and
 * the projected INFO card. Colors come ONLY from the canonical design tokens —
 * ALL in-world lettering (#f0e8d6) sits on deep ink (14.64:1 pre-grade, 4.23:1
 * graded-worst ≥ the 3.9 floor). Gold (#d4b06a) is the non-text frame rule only:
 * gold-on-ink grades to 2.82:1 (< floor), so it is never used for painted copy.
 * Pure painters with an injected canvas factory
 * keep this unit-testable headlessly (jsdom has no 2D context), mirroring the
 * ClimateProjector seam. The full verbatim copy stays in the a11y DOM mirror;
 * these planes carry a legible, truncated rendition for the room.
 */
import * as THREE from 'three';
import {
  BIO_PARAGRAPH,
  HEADLINE,
  SITE_OWNER,
  WELCOME_TITLE,
} from '../content/bio';
import {
  CLIMATE_ATTRIBUTION_LINE,
  CLIMATE_STATEMENT,
  CLIMATE_TITLE,
} from '../content/climate';
import { displayTags, type Post } from '../content/posts';
import { DESIGN_TOKENS } from '../styles/design-tokens';

export const DETAIL_TEXTURE = {
  width: 640,
  height: 480,
  margin: 30,
  fontPx: 22,
  lineHeight: 30,
  maxChars: 44,
  maxLines: 9,
} as const;

export type DetailCanvasFactory = (
  width: number,
  height: number,
) => HTMLCanvasElement;

export const browserDetailCanvas: DetailCanvasFactory = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

/** Strip legacy description HTML to plain text (verbatim copy, markup removed). */
export function stripDetailHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Deterministic word wrap — exported so tests can assert glyph bounds. */
export function wrapDetailText(
  text: string,
  maxChars: number = DETAIL_TEXTURE.maxChars,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && next.length > maxChars) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export interface DetailSpec {
  /** Stable cache/dispose key and headless-test handle. */
  key: string;
  eyebrow: string;
  title: string;
  lines: readonly string[];
  footer: string;
}

export function postDetailSpecs(post: Post): {
  cover: DetailSpec;
  body: DetailSpec;
} {
  const id = slug(post.title);
  const tags = displayTags(post).join(' · ');
  const descriptionLines = wrapDetailText(
    stripDetailHtml(post.descriptionHtml),
  );
  const repo = post.repoUrl ?? 'Repository is private — details under NDA.';
  return {
    cover: {
      key: `book-cover:${id}`,
      eyebrow: 'EXPERIENCE · LIBRARY',
      title: post.title,
      lines: tags ? ['TAGS', ...wrapDetailText(tags)] : ['OPEN THE BOOK'],
      footer: 'Turn the page in-world →',
    },
    body: {
      key: `book-body:${id}`,
      eyebrow: 'OPEN BOOK · DETAIL',
      title: post.title,
      lines: descriptionLines,
      footer: repo,
    },
  };
}

export function caseDetailSpec(post: Post): DetailSpec {
  const tags = displayTags(post).join(' · ');
  return {
    key: `case:${slug(post.title)}`,
    eyebrow: 'PROJECTS · CASE FILE',
    title: post.title,
    lines: [
      ...(tags ? ['TAGS', ...wrapDetailText(tags)] : []),
      ...wrapDetailText(stripDetailHtml(post.descriptionHtml)).slice(0, 5),
    ],
    footer: post.repoUrl ?? 'Private repository — details under NDA.',
  };
}

export function monitorDetailSpec(): DetailSpec {
  return {
    key: 'monitor:about',
    eyebrow: 'DESK · CRT',
    title: WELCOME_TITLE,
    lines: [SITE_OWNER, HEADLINE, ...wrapDetailText(BIO_PARAGRAPH)],
    footer: 'Full desktop: focus the hidden panel (Tab)',
  };
}

export function climateDetailSpec(todayLabel: string): DetailSpec {
  return {
    key: `projector:${todayLabel}`,
    eyebrow: 'CLIMATE · PROJECTOR',
    title: CLIMATE_TITLE,
    lines: [todayLabel, ...wrapDetailText(CLIMATE_STATEMENT)],
    footer: CLIMATE_ATTRIBUTION_LINE,
  };
}

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Paint one detail page. Returns null when no 2D context exists (headless /
 * software-disabled canvas) so callers can skip the plane rather than crash.
 */
export function paintDetailTexture(
  spec: DetailSpec,
  factory: DetailCanvasFactory = browserDetailCanvas,
): THREE.CanvasTexture | null {
  const { width, height, margin, fontPx, lineHeight, maxChars, maxLines } =
    DETAIL_TEXTURE;
  const canvas = factory(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Ink inlay + lettering glyphs + a gold (non-text) frame rule — never
  // gold-on-brass, and never gold COPY on ink (2.82:1 graded-worst < 3.9 floor).
  ctx.fillStyle = DESIGN_TOKENS.p5.black;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = DESIGN_TOKENS.scene.brassLight;
  ctx.lineWidth = 4;
  ctx.strokeRect(margin / 2, margin / 2, width - margin, height - margin);

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = DESIGN_TOKENS.climate.projectorPlaqueText;
  ctx.font = `bold 20px ${DESIGN_TOKENS.type.display}`;
  ctx.fillText(spec.eyebrow, margin, margin);

  const titleLines = wrapDetailText(spec.title, 28).slice(0, 2);
  ctx.fillStyle = DESIGN_TOKENS.climate.projectorPlaqueText;
  ctx.font = `bold 38px ${DESIGN_TOKENS.type.display}`;
  let y = margin + 34;
  for (const line of titleLines) {
    ctx.fillText(line, margin, y);
    y += 42;
  }
  ctx.fillStyle = DESIGN_TOKENS.scene.brassLight;
  ctx.fillRect(margin, y + 4, width - margin * 2, 3);
  y += 24;

  // The footer owns a fixed baseline. A two-line title costs an extra 42px,
  // so derive the body budget from the space that ACTUALLY remains instead of
  // always drawing `maxLines` (which overlapped the footer on long titles).
  const footerY = height - margin - 22;
  const FOOTER_GAP = 10;
  const bodyBudget = Math.max(
    1,
    Math.floor((footerY - y - FOOTER_GAP) / lineHeight),
  );
  const bodyLimit = Math.min(maxLines, bodyBudget);
  ctx.font = `${fontPx}px ${DESIGN_TOKENS.type.body}`;
  ctx.fillStyle = DESIGN_TOKENS.climate.projectorPlaqueText;
  const bodyLines = wrapDetailText(spec.lines.join('  '), maxChars);
  const shown = bodyLines.slice(0, bodyLimit);
  if (bodyLines.length > bodyLimit) shown[bodyLimit - 1] = '…';
  for (const line of shown) {
    ctx.fillText(line, margin, y);
    y += lineHeight;
  }

  ctx.fillStyle = DESIGN_TOKENS.climate.projectorPlaqueText;
  ctx.font = `bold 18px ${DESIGN_TOKENS.type.body}`;
  ctx.fillText(wrapDetailText(spec.footer, maxChars)[0] ?? '', margin, footerY);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
