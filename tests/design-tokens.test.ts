/**
 * Canonical token guards. The token store is the one source of truth and
 * every derived layer carries exactly the canonical values (commit 2 moved
 * them onto the unified Dishonored+purple palette; the pins below follow the
 * tokens, so a future deliberate recolor stays one small JSON diff).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LEVEL_COLORS } from '../src/lib/climate';
import { BOOK_SPINE_COLORS, PALETTE } from '../src/scene/art/palette';
import {
  ALL_TOKEN_VALUES,
  DESIGN_TOKENS,
  MANTINE_PRIMARY_COLOR,
  MANTINE_THEME_ROLES,
  normalizeHex,
} from '../src/styles/design-tokens';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const kebab = (role: string): string =>
  role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

describe('canonical design tokens', () => {
  it('never intersects the heatmap LEVEL_COLORS data scale', () => {
    const dataScale = new Set(LEVEL_COLORS.map(normalizeHex));
    const overlap = ALL_TOKEN_VALUES.map(normalizeHex).filter((value) =>
      dataScale.has(value),
    );
    expect(overlap).toEqual([]);
  });

  it('keeps the derived scene PALETTE byte-identical to token roles', () => {
    for (const [role, value] of Object.entries(PALETTE)) {
      expect(value, `PALETTE.${role}`).toBe(
        DESIGN_TOKENS.scene[role as keyof typeof DESIGN_TOKENS.scene],
      );
    }
    expect([...BOOK_SPINE_COLORS]).toEqual([...DESIGN_TOKENS.bookSpines]);
  });

  it('pins the duplicated values that appear in more than one layer', () => {
    expect(DESIGN_TOKENS.scene.ink).toBe(DESIGN_TOKENS.p5.ink);
    expect(DESIGN_TOKENS.scene.p5Red).toBe(DESIGN_TOKENS.p5.red);
    expect(DESIGN_TOKENS.scene.p5Yellow).toBe(DESIGN_TOKENS.p5.yellow);
    expect(DESIGN_TOKENS.scene.paper).toBe(
      DESIGN_TOKENS.climate.projectorCloth,
    );
    expect(DESIGN_TOKENS.scene.lampWarm).toBe(DESIGN_TOKENS.room.lamp);
    expect(DESIGN_TOKENS.material.textureNeutral).toBe(DESIGN_TOKENS.p5.white);
    expect(DESIGN_TOKENS.climate.heatmapLabelText).toBe(DESIGN_TOKENS.p5.white);
  });

  it('matches every p5.css :root color declaration to its token role', () => {
    const root = /:root\s*\{([\s\S]*?)\}/.exec(
      read('../src/styles/p5.css'),
    )?.[1];
    expect(root).toBeDefined();
    const declared = new Map<string, string>();
    for (const match of (root ?? '').matchAll(
      /(--[\w-]+)\s*:\s*(#[0-9a-f]+)\s*;/gi,
    )) {
      declared.set(match[1] ?? '', match[2] ?? '');
    }
    const expected = Object.entries(DESIGN_TOKENS.p5).map(
      ([role, value]) => [`--p5-${kebab(role)}`, value] as const,
    );
    expect([...declared.keys()].sort()).toEqual(
      expected.map(([name]) => name).sort(),
    );
    for (const [name, value] of expected) {
      expect(normalizeHex(declared.get(name) ?? ''), name).toBe(
        normalizeHex(value),
      );
    }
  });

  it('exposes a Mantine-ready semantic palette of canonical values', () => {
    expect(Object.keys(MANTINE_THEME_ROLES).sort()).toEqual(
      [
        'background',
        'panel',
        'text',
        'accent',
        'teal',
        'brass',
        'gold',
        'purple',
        'danger',
        'focus',
      ].sort(),
    );
    const canonical = ALL_TOKEN_VALUES.map(normalizeHex);
    for (const [role, value] of Object.entries(MANTINE_THEME_ROLES)) {
      expect(canonical, `${role} must be an existing token value`).toContain(
        normalizeHex(value),
      );
    }
    expect(MANTINE_PRIMARY_COLOR).toBe('accent');
    expect(MANTINE_THEME_ROLES.background).toBe(DESIGN_TOKENS.p5.black);
    expect(MANTINE_THEME_ROLES.focus).toBe(DESIGN_TOKENS.p5.yellow);
    expect(MANTINE_THEME_ROLES.gold).toBe(DESIGN_TOKENS.scene.brassLight);
    // Danger is rust (redDeep), never the brass/gold accent.
    expect(MANTINE_THEME_ROLES.danger).toBe(DESIGN_TOKENS.p5.redDeep);
  });

  it('normalizes shorthand hex for mirror comparisons', () => {
    expect(normalizeHex('#FFF')).toBe('#ffffff');
    expect(normalizeHex(' #0a0a0a ')).toBe('#0a0a0a');
  });
});
