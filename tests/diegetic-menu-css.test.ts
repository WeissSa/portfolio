/**
 * Diegetic-only 3D desktop CSS contract (owner review 2026-11-24). Source-level
 * assertions are the headless equivalent of the Playwright pointer/keyboard
 * checks: the sr-only DOM menu must stay tabbable, but reveal ONLY on genuine
 * keyboard focus, and the diegetic right column must start at 768px so a fine
 * pointer between 768–1023px never sees an empty gutter over the plaque.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const CSS = read('../src/styles/p5.css').replace(/\/\*[\s\S]*?\*\//g, '');

describe('diegetic DOM menu reveal', () => {
  it('hides the menu for fine pointers in a live scene', () => {
    expect(CSS).toContain('.app-scene-live.app-fine-pointer .main-menu');
    const hidden =
      /\.app-scene-live\.app-fine-pointer \.main-menu\s*\{([^}]*)\}/.exec(CSS);
    expect(hidden?.[1]).toMatch(/clip-path:\s*inset\(50%\)/);
    expect(hidden?.[1]).toMatch(/width:\s*1px/);
  });

  it('reveals on keyboard focus only — never on :focus-within (mouse clicks)', () => {
    expect(CSS).toContain(
      '.app-scene-live.app-fine-pointer .main-menu:has(:focus-visible)',
    );
    expect(CSS).not.toMatch(
      /\.main-menu:focus-within\s*\{[^}]*(position:\s*fixed)/,
    );
    // The focus chip follows the same keyboard-only selector.
    expect(CSS).toContain(
      '.app-scene-live.app-fine-pointer\n  .main-menu:has(:focus-visible)\n  .main-menu__focus-chip',
    );
    const revealed =
      /\.app-scene-live\.app-fine-pointer \.main-menu:has\(:focus-visible\)\s*\{([^}]*)\}/.exec(
        CSS,
      );
    expect(revealed?.[1]).toMatch(/position:\s*fixed/);
    expect(revealed?.[1]).toMatch(/border:\s*2px solid var\(--state-focus\)/);
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
