/**
 * Mantine theme bridge (Mantine-first commit).
 *
 * The ONE place `@mantine/core` meets the canonical design tokens: the theme
 * is derived exclusively from `MANTINE_THEME_ROLES` + `MANTINE_PRIMARY_COLOR`
 * in ./design-tokens, so the hex-ban lint stays green (no raw color literals
 * here) and commit 2's palette recolor retargets Mantine automatically.
 *
 * Values are deliberately IDENTICAL to the current palette — every Mantine
 * color is a flat 10-shade tuple of the existing token value, so introducing
 * Mantine changes no rendered color. Shade ramps may be derived from tokens in
 * a later, explicitly reviewed commit.
 */
import { createTheme, type MantineColorsTuple } from '@mantine/core';
import {
  DESIGN_TOKENS,
  MANTINE_PRIMARY_COLOR,
  MANTINE_THEME_ROLES,
} from './design-tokens';

/** Flat 10-shade tuple: every shade IS the canonical token value. */
function solid(value: string): MantineColorsTuple {
  // A tuple literal needs no cast: the 10 entries are checked against the
  // MantineColorsTuple shape directly.
  return [value, value, value, value, value, value, value, value, value, value];
}

export const MANTINE_COLORS = {
  background: solid(MANTINE_THEME_ROLES.background),
  panel: solid(MANTINE_THEME_ROLES.panel),
  text: solid(MANTINE_THEME_ROLES.text),
  accent: solid(MANTINE_THEME_ROLES.accent),
  teal: solid(MANTINE_THEME_ROLES.teal),
  brass: solid(MANTINE_THEME_ROLES.brass),
  gold: solid(MANTINE_THEME_ROLES.gold),
  purple: solid(MANTINE_THEME_ROLES.purple),
  danger: solid(MANTINE_THEME_ROLES.danger),
  focus: solid(MANTINE_THEME_ROLES.focus),
} as const satisfies Record<string, MantineColorsTuple>;

export const mantineTheme = createTheme({
  colors: MANTINE_COLORS,
  primaryColor: MANTINE_PRIMARY_COLOR,
  black: MANTINE_THEME_ROLES.background,
  white: MANTINE_THEME_ROLES.text,
  // The P5 typography stack stays authoritative: inherit whatever the custom
  // CSS layers already set instead of imposing Mantine's default stack.
  fontFamily: 'inherit',
  headings: { fontFamily: 'inherit' },
  defaultRadius: 'sm',
  defaultGradient: { from: 'accent', to: 'accent' },
  // Reduced-motion awareness stays a first-class concern (plan §0).
  respectReducedMotion: true,
  other: {
    /** Mirror of the semantic roles for Styles-API consumers (tokens only). */
    designTokens: DESIGN_TOKENS.p5,
  },
});
