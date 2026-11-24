/**
 * Semantic CSS alias parity (review follow-up, 2026-11-23).
 *
 * The --state-* / --border-* / --type-* / --space-* aliases in p5.css are
 * var() references or literal scale values — INVISIBLE to the hex-only color
 * guards (eslint-no-raw-hex / css-hex-guard). A wrong-role alias (e.g.
 * --state-focus pointing at --p5-link instead of the gold focus token) would
 * ship with fully green lints. This test parses the p5.css :root block,
 * resolves the var() chains, and compares every alias against the intended
 * DESIGN_TOKENS.state / .border / .type / .spacing value, so a wrong-role
 * alias fails CI.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DESIGN_TOKENS, normalizeHex } from '../src/styles/design-tokens';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const kebab = (role: string): string =>
  role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** All `--name: value;` declarations inside the first :root block. */
function parseRootDeclarations(css: string): Map<string, string> {
  const root = /:root\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? '';
  const declared = new Map<string, string>();
  for (const match of root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    declared.set(match[1] ?? '', (match[2] ?? '').trim());
  }
  return declared;
}

/** Resolve var(--x) references through the declaration map (cycle-safe). */
function resolveVar(
  value: string,
  declared: Map<string, string>,
  depth = 0,
): string {
  if (depth > 10) return value;
  return value.replace(/var\((--[\w-]+)\)/g, (_all, name: string) =>
    resolveVar(declared.get(name) ?? '', declared, depth + 1),
  );
}

const css = read('../src/styles/p5.css');
const declared = parseRootDeclarations(css);
const resolved = (name: string): string =>
  resolveVar(declared.get(name) ?? '', declared);

describe('semantic CSS alias parity (p5.css ↔ design tokens)', () => {
  it('every state/border alias resolves to its exact token value', () => {
    // These two groups are the a11y-critical semantic roles (active chip,
    // focus ring, visited link, mandatory panel border): ALL roles required.
    const groups = {
      state: { prefix: 'state', tokens: DESIGN_TOKENS.state },
      border: { prefix: 'border', tokens: DESIGN_TOKENS.border },
    } as const;
    for (const [group, { prefix, tokens }] of Object.entries(groups)) {
      for (const [role, expected] of Object.entries(tokens)) {
        const name = `--${prefix}-${kebab(role)}`;
        expect(declared.has(name), `${name} must be declared in :root`).toBe(
          true,
        );
        expect(
          normalizeHex(resolved(name)),
          `${name} must resolve to DESIGN_TOKENS.${group}.${role}`,
        ).toBe(normalizeHex(expected));
      }
    }
  });

  it('every declared type/space scale alias matches its token role', () => {
    // Reverse direction: whatever the stylesheet declares under the --type-*/
    // --space-* prefixes must equal the canonical scale (no rogue steps).
    const scales: Record<string, Record<string, string>> = {
      type: DESIGN_TOKENS.type,
      space: DESIGN_TOKENS.spacing,
    };
    let checked = 0;
    for (const name of declared.keys()) {
      const match = /^--(type|space)-([\w-]+)$/.exec(name);
      if (!match) continue;
      const prefix = match[1] as string;
      const role = match[2] as string;
      const expected = scales[prefix]?.[role];
      expect(expected, `${name} has no matching token role`).toBeDefined();
      expect(normalizeHex(resolved(name)), name).toBe(
        normalizeHex(expected ?? ''),
      );
      checked += 1;
    }
    // xs..3xl type steps + xs..xl spacing steps + the tokenized panel cut.
    expect(checked).toBeGreaterThanOrEqual(12);
  });

  it('the tokenized --p5-cut resolves to the spacing.cut token', () => {
    expect(resolved('--space-cut')).toBe(DESIGN_TOKENS.spacing.cut);
    expect(resolved('--p5-cut')).toBe(DESIGN_TOKENS.spacing.cut);
  });

  it('color aliases reference the canonical --p5-* vars, never a raw hex', () => {
    for (const name of [
      '--state-active-fg',
      '--state-active-bg',
      '--state-focus',
      '--state-visited',
      '--border-panel',
      '--space-cut',
    ]) {
      expect(declared.get(name), name).toMatch(/^var\(--p5-/);
    }
  });

  it('pins the state-hierarchy roles: active = ink-on-gold, focus = gold', () => {
    expect(resolved('--state-active-fg')).toBe(DESIGN_TOKENS.p5.black);
    expect(resolved('--state-active-bg')).toBe(DESIGN_TOKENS.p5.yellow);
    expect(resolved('--state-focus')).toBe(DESIGN_TOKENS.p5.yellow);
    expect(resolved('--state-visited')).toBe(DESIGN_TOKENS.p5.linkVisited);
    expect(resolved('--border-panel')).toBe(DESIGN_TOKENS.p5.red);
  });
});
