/**
 * Critical-CSS parity guard (REWORK_PLAN §4.5, extended in commit 1b):
 * the hand-authored `<style data-critical-mirror>` block in the source
 * index.html styles the static mirror in DEV (where app CSS only arrives via
 * JS). The build strips that block and inlines the full bundle CSS, which
 * carries the same mirror rules from src/styles/static-mirror.css. If the two
 * selector sets — or any declaration VALUE — drift apart, dev regresses to a
 * partially-styled first paint (FOUC) while the build still looks fine.
 *
 * Commit 1b also pins the design-token ↔ p5.css :root value parity so the
 * canonical module and the stylesheet cannot disagree after the commit-2
 * recolor.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findRawHexOutsideRoot } from '../scripts/css-hex-guard.mjs';
import { DESIGN_TOKENS, normalizeHex } from '../src/styles/design-tokens';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const INDEX_HTML = read('../index.html');
const MIRROR_CSS = read('../src/styles/static-mirror.css');
const P5_CSS = read('../src/styles/p5.css');

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
 * split on commas).
 */
function mirrorSelectors(css: string): string[] {
  const selectors: string[] = [];
  for (const [selector] of mirrorRuleEntries(css)) selectors.push(selector);
  return selectors.sort();
}

/** Quote-insensitive, whitespace-collapsed, lowercased declaration value. */
function normalizeValue(value: string): string {
  return value.replace(/['"]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Every `.static-mirror` rule as a sorted `selector -> [prop: value]` map,
 * so parity covers DECLARATIONS as well as the selector set. Non-mirror rules
 * (`:root`, `html, body`) are intentionally out of scope: only the mirror's
 * first paint is the contract here.
 */
function mirrorRuleEntries(css: string): [string, string[]][] {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = new Map<string, string[]>();
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(body)) !== null) {
    const group = match[1] ?? '';
    const selectors = group
      .split(',')
      .map((part) => part.replace(/\s+/g, ' ').trim())
      .filter((selector) => selector.includes('.static-mirror'));
    if (!selectors.length) continue;
    const declarations = (match[2] ?? '')
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const colon = declaration.indexOf(':');
        const property = declaration.slice(0, colon).trim().toLowerCase();
        const value = normalizeValue(declaration.slice(colon + 1));
        return `${property}: ${value}`;
      })
      .sort();
    for (const selector of selectors) {
      rules.set(
        selector,
        [...(rules.get(selector) ?? []), ...declarations].sort(),
      );
    }
  }
  return [...rules.entries()].sort(([a], [b]) => a.localeCompare(b));
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

  it('.static-mirror DECLARATION VALUES match the stylesheet exactly', () => {
    const block = extractCriticalBlock(INDEX_HTML);
    expect(block).not.toBeNull();
    const inline = mirrorRuleEntries(block ?? '');
    const stylesheet = mirrorRuleEntries(MIRROR_CSS);
    expect(inline.length).toBeGreaterThan(10);
    expect(inline).toEqual(stylesheet);
  });

  it('the critical block keeps its colors token-backed (no raw hex outside :root)', () => {
    const block = extractCriticalBlock(INDEX_HTML) ?? '';
    expect(findRawHexOutsideRoot(block)).toEqual([]);
  });

  it('design tokens match every p5.css :root color declaration', () => {
    const root = /:root\s*\{([\s\S]*?)\}/.exec(P5_CSS)?.[1] ?? '';
    const declared = new Map<string, string>();
    for (const match of root.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-f]+)\s*;/gi)) {
      declared.set(match[1] ?? '', normalizeHex(match[2] ?? ''));
    }
    for (const [role, value] of Object.entries(DESIGN_TOKENS.p5)) {
      const name = `--p5-${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
      expect(declared.get(name), name).toBe(normalizeHex(value));
    }
    expect(declared.size).toBe(Object.keys(DESIGN_TOKENS.p5).length);
  });
});
