/**
 * Review fix A2 (CSS assertion): in 3D mode the DOM shell sits above the
 * Canvas, so it must be pointer-transparent with only its interactive
 * descendants opted back in — otherwise R3F can never raycast a book/monitor
 * except in the outer margins. 2D mode must keep its normal pointer behaviour.
 * Source-level assertions are the headless equivalent of a browser click test.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Indirect via a helper (as in critical-css-parity.test.ts): Vite statically
// rewrites a literal `new URL('./x', import.meta.url)` into an asset URL.
const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const P5_CSS = read('../src/styles/p5.css').replace(/\/\*[\s\S]*?\*\//g, '');

function bodyFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(P5_CSS);
  if (!match) throw new Error(`CSS rule not found: ${selector}`);
  return match[1]!;
}

describe('3D canvas pointer routing (review fix A2)', () => {
  it('makes the 3D app shell pointer-transparent so clicks reach the canvas', () => {
    expect(bodyFor('.app-3d .app-shell')).toMatch(/pointer-events:\s*none/);
  });

  it('re-enables pointer events on interactive DOM descendants', () => {
    const interactive = [
      '.app-3d .app-shell a', // menu links + contact icons
      '.app-3d .app-shell button', // mode toggle + desktop icons/close
      '.app-3d .app-shell input',
      ".app-3d .app-shell [role='button']",
      ".app-3d .app-shell [role='dialog']", // overlay windows
      ".app-3d .app-shell [role='group']", // rendering-mode toggle
      ".app-3d .app-shell [tabindex]:not([tabindex='-1'])",
    ];
    for (const selector of interactive) {
      expect(P5_CSS).toContain(selector);
    }
    expect(
      bodyFor(".app-3d .app-shell [tabindex]:not([tabindex='-1'])"),
    ).toMatch(/pointer-events:\s*auto/);
  });

  it('leaves 2D mode untouched (no unscoped .app-shell pointer-events rule)', () => {
    expect(P5_CSS).not.toMatch(
      /(?:^|\})\s*\.app-shell\s*\{[^}]*pointer-events:\s*none/m,
    );
  });

  it('still gates 3D picking behind ready + fine-pointer interactivity', () => {
    expect(bodyFor('.scene-layer')).toMatch(/pointer-events:\s*none/);
    expect(bodyFor('.scene-layer--interactive .scene-canvas')).toMatch(
      /pointer-events:\s*auto/,
    );
  });

  it('renders the desktop zoom full-screen and above the shell', () => {
    expect(bodyFor('.desktop-zoom')).toMatch(/position:\s*fixed/);
    expect(bodyFor('.desktop-zoom')).toMatch(/z-index:\s*10/);
    // Crossfade: the keyframes ramp opacity from transparent to opaque.
    expect(P5_CSS).toMatch(
      /@keyframes desktop-zoom-in\s*\{[\s\S]*?opacity:\s*0[\s\S]*?opacity:\s*1/,
    );
  });
});
