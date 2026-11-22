import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import App from '../src/App';
import { usePortfolioStore } from '../src/state/store';

/**
 * The static mirror is replaced by React in a single createRoot().render()
 * call. If the initial mount played the `.p5-cut-in` animation, the very
 * first React frame would be opacity:0 + translateX(-24px) — a visible jump
 * right after the fully-styled mirror. The shell therefore marks itself
 * `app-initial` until the first real navigation, and p5.css suppresses the
 * cut-in inside that class.
 */
describe('initial-mount handoff (no frame-0 jump)', () => {
  beforeEach(() => {
    window.location.hash = '';
    usePortfolioStore.setState({ activeZone: '/', hasNavigated: false });
  });

  function appContainer(): HTMLElement {
    // The top-level shell div rendered by App (skip link is its first child).
    const skip = screen.getByRole('link', { name: /skip to content/i });
    return skip.parentElement as HTMLElement;
  }

  it('marks the shell app-initial before any navigation', () => {
    render(<App />);
    expect(appContainer()).toHaveClass('app-initial');
  });

  it('drops app-initial after a real zone change', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(appContainer()).toHaveClass('app-initial');

    await user.click(screen.getByRole('link', { name: 'Projects' }));
    expect(window.location.hash).toBe('#/projects');
    expect(
      await screen.findByText('Projects zone selected'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(appContainer()).not.toHaveClass('app-initial');
      expect(usePortfolioStore.getState().hasNavigated).toBe(true);
    });
  });

  it('keeps app-initial on a deep link until a real in-app navigation', async () => {
    const user = userEvent.setup();
    // A legacy/deep link lands directly on #/projects while the store still
    // holds its default '/' zone. Adopting that route on first paint must not
    // count as navigation (no cut-in on frame 0).
    window.location.hash = '#/projects';

    render(<App />);
    expect(appContainer()).toHaveClass('app-initial');
    expect(usePortfolioStore.getState().hasNavigated).toBe(false);

    await user.click(screen.getByRole('link', { name: 'About' }));
    expect(window.location.hash).toBe('#/about');
    await waitFor(() => {
      expect(appContainer()).not.toHaveClass('app-initial');
      expect(usePortfolioStore.getState().hasNavigated).toBe(true);
    });
  });

  it('p5.css suppresses the cut-in animation inside .app-initial', () => {
    // jsdom does not apply real stylesheets; assert on the source rule that
    // the initial mount never plays the animation (reduced-motion block
    // remains untouched further down the file). Vitest runs with the repo
    // root as cwd; jsdom rewrites import.meta.url, so a cwd-relative path is
    // the reliable way (same pattern as tests/legacy-404.test.ts).
    const css = readFileSync(
      resolve(process.cwd(), 'src/styles/p5.css'),
      'utf8',
    );
    expect(css).toMatch(
      /\.app-initial\s+\.p5-cut-in\s*\{\s*animation:\s*none;?\s*\}/,
    );
    const initialIdx = css.indexOf('.app-initial .p5-cut-in');
    const reducedIdx = css.indexOf('@media (prefers-reduced-motion');
    expect(initialIdx).toBeGreaterThan(-1);
    expect(reducedIdx).toBeGreaterThan(-1);
    // Guard the source ordering: the app-initial rule stays above the
    // reduced-motion block instead of drifting into/behind it.
    expect(initialIdx).toBeLessThan(reducedIdx);
  });
});
