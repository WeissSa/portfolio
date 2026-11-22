/**
 * Critical-CSS parity guard (REWORK_PLAN §4.5):
 * the hand-authored `<style data-critical-mirror>` block in the source
 * index.html styles the static mirror in DEV (where app CSS only arrives via
 * JS). The build strips that block and inlines the full bundle CSS, which
 * carries the same mirror rules from src/styles/static-mirror.css. If the two
 * selector sets drift apart, dev regresses to a partially-styled first paint
 * (FOUC) while the build still looks fine — so we pin the parity here.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const INDEX_HTML = read('../index.html');
const MIRROR_CSS = read('../src/styles/static-mirror.css');

/** Extract the raw CSS of the hand-authored critical block, or null. */
function extractCriticalBlock(html: string): string | null {
  const match =
    /<style\b[^>]*\bdata-critical-mirror\b[^>]*>([\s\S]*?)<\/style\s*>/i.exec(
      html,
    );
  return match?.[1] ?? null;
}

/**
 * Collect every `.static-mirror`-scoped selector from a CSS string as a
 * sorted, whitespace-normalized list (comments stripped, selector groups
 * split on commas). Declarations are intentionally ignored: only selector
 * coverage parity is guarded here.
 */
function mirrorSelectors(css: string): string[] {
  const selectors: string[] = [];
  const rulePattern = /([^{}]+)\{[^{}]*\}/g;
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(body)) !== null) {
    const group = match[1] ?? '';
    for (const part of group.split(',')) {
      const selector = part.replace(/\s+/g, ' ').trim();
      if (selector.includes('.static-mirror')) selectors.push(selector);
    }
  }
  return selectors.sort();
}

describe('critical-CSS parity (index.html ↔ static-mirror.css)', () => {
  it('source index.html contains the data-critical-mirror style block', () => {
    expect(INDEX_HTML).toContain('<style data-critical-mirror>');
    expect(extractCriticalBlock(INDEX_HTML)).not.toBeNull();
  });

  it('static-mirror.css exposes a non-empty .static-mirror selector set', () => {
    expect(mirrorSelectors(MIRROR_CSS).length).toBeGreaterThan(10);
  });

  it('.static-mirror selectors in the critical block match the stylesheet exactly', () => {
    const block = extractCriticalBlock(INDEX_HTML);
    expect(block).not.toBeNull();
    const inline = mirrorSelectors(block ?? '');
    const stylesheet = mirrorSelectors(MIRROR_CSS);
    // Drift in either direction breaks dev-first-paint parity, so compare
    // the full sorted sets (not just containment).
    expect(inline).toEqual(stylesheet);
  });
});
