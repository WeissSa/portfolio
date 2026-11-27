/**
 * Source-level CSS contract for the UX fix pass (2026-11-25). The real-browser
 * assertions live in scripts/qa/*.spec.ts; these guards keep the two visible
 * affordances — the always-visible pointer menu strip (alongside the sr-only
 * semantic nav) and the scrollable detail panel — from silently regressing
 * back to "no pointer menu" and truncated painted text.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const CSS = read('../src/styles/p5.css').replace(/\/\*[\s\S]*?\*\//g, '');

describe('semantic nav + pointer-visible room strip', () => {
  it('keeps the semantic nav sr-only but tabbable in a live scene', () => {
    const block =
      /\.app-scene-live\.app-fine-pointer \.main-menu\s*\{([^}]*)\}/.exec(
        CSS,
      )?.[1];
    expect(block).toMatch(/clip-path:\s*inset\(50%\)/);
    expect(block).toMatch(/width:\s*1px/);
    expect(block).not.toMatch(/display:\s*none/);
    expect(CSS).toContain(
      '.app-scene-live.app-fine-pointer .main-menu:has(:focus-visible)',
    );
  });

  it('adds an always-visible pointer strip above the detail scrim', () => {
    const block = /\.pointer-menu-strip\s*\{([^}]*)\}/.exec(CSS)?.[1];
    expect(block).toMatch(/position:\s*fixed/);
    expect(block).toMatch(/z-index:\s*12/);
    expect(block).toMatch(/flex-wrap:\s*wrap/);
    expect(block).toMatch(/border:\s*2px solid var\(--state-focus\)/);
    expect(block).not.toMatch(/clip-path:\s*inset\(50%\)/);
  });

  it('keeps the diegetic right column from 768px (no 768–1023 gutter)', () => {
    expect(CSS).toContain('@media (min-width: 768px)');
    expect(CSS).not.toContain('@media (min-width: 1024px)');
    const block = /@media \(min-width: 768px\)\s*\{([\s\S]*?)\n\}/.exec(
      CSS,
    )?.[1];
    expect(block).toContain(
      '.app-scene-live.app-fine-pointer .app-shell > div:first-of-type',
    );
    expect(block).toMatch(/flex:\s*0 0 50%/);
  });

  it('shows the active rendering mode with the gold active chip', () => {
    const block = /\.p5-btn\[aria-pressed='true'\]\s*\{([^}]*)\}/.exec(
      CSS,
    )?.[1];
    expect(block).toMatch(/background:\s*var\(--state-active-bg\)/);
    expect(block).toMatch(/color:\s*var\(--state-active-fg\)/);
  });
});

describe('unified readable detail panel', () => {
  it('is a fixed, height-capped, pointer-enabled dialog in every mode', () => {
    const block = /\.detail-mirror\s*\{([^}]*)\}/.exec(CSS)?.[1];
    expect(block).toMatch(/position:\s*fixed/);
    expect(block).toMatch(/max-height:/);
    expect(block).toMatch(/pointer-events:\s*auto/);
    expect(block).not.toMatch(/clip-path:\s*inset\(50%\)/);
    expect(block).not.toMatch(/width:\s*1px/);
  });

  it('scrolls long content at a readable size', () => {
    const body = /\.detail-mirror__body\s*\{([^}]*)\}/.exec(CSS)?.[1];
    expect(body).toMatch(/overflow-y:\s*auto/);
    expect(body).toMatch(/font-size:\s*15px/);
    expect(body).toMatch(/overscroll-behavior:\s*contain/);
  });

  it('has a click-dismissible scrim that is not opaque', () => {
    const scrim = /\.detail-panel-scrim\s*\{([^}]*)\}/.exec(CSS)?.[1];
    expect(scrim).toMatch(/position:\s*fixed/);
    expect(scrim).toMatch(/color-mix/);
    expect(scrim).not.toMatch(/background:\s*var\(--p5-black\)/);
  });
});
