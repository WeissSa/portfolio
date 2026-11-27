/**
 * Mantine-first commit: the Mantine theme must be a pure derivation of the
 * canonical design tokens — same values, no drift, no new colors — and the
 * provider must run the app in the dark scheme. (Palette RECOLOR happens only
 * in art-overhaul commit 2; this test pins the derivation, not the values.)
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import {
  MANTINE_PRIMARY_COLOR,
  MANTINE_THEME_ROLES,
  type MantineThemeRole,
} from '../src/styles/design-tokens';
import { MANTINE_COLORS, mantineTheme } from '../src/styles/mantine-theme';

const ROLES = Object.keys(MANTINE_THEME_ROLES) as MantineThemeRole[];

describe('mantine theme (single source of truth: design tokens)', () => {
  it('exposes exactly the semantic roles as Mantine colors', () => {
    expect(Object.keys(MANTINE_COLORS).sort()).toEqual([...ROLES].sort());
    for (const role of ROLES) {
      expect(MANTINE_COLORS[role]).toHaveLength(10);
    }
  });

  it('every shade of every role equals the canonical token value (identical values)', () => {
    for (const role of ROLES) {
      for (const shade of MANTINE_COLORS[role]) {
        expect(shade).toBe(MANTINE_THEME_ROLES[role]);
      }
    }
  });

  it('uses the token-defined primary color and derives black/white from tokens', () => {
    expect(mantineTheme.primaryColor).toBe(MANTINE_PRIMARY_COLOR);
    expect(mantineTheme.primaryColor).toBe('accent');
    expect(mantineTheme.black).toBe(MANTINE_THEME_ROLES.background);
    expect(mantineTheme.white).toBe(MANTINE_THEME_ROLES.text);
    expect(mantineTheme.colors?.accent?.[6]).toBe(MANTINE_THEME_ROLES.accent);
  });

  it('keeps motion preferences and inherited typography authoritative', () => {
    expect(mantineTheme.respectReducedMotion).toBe(true);
    expect(mantineTheme.fontFamily).toBe('inherit');
    expect(mantineTheme.headings?.fontFamily).toBe('inherit');
  });

  it('forces the dark color scheme on the document element', () => {
    render(
      <MantineProvider theme={mantineTheme} forceColorScheme="dark">
        <div />
      </MantineProvider>,
    );
    expect(
      document.documentElement.getAttribute('data-mantine-color-scheme'),
    ).toBe('dark');
  });
});
