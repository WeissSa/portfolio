import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import App from '../src/App';
import { POSTS, postId } from '../src/content/posts';
import { usePortfolioStore } from '../src/state/store';

// jsdom has no WebGL: the lazy Canvas is replaced by a marker so forced-3D
// scans exercise the real DOM shell, sr-only menu and dialogs over the canvas.
vi.mock('../src/ui/SceneLayer', () => ({
  SceneLayer: () => <div data-testid="scene-layer-stub" aria-hidden="true" />,
}));

beforeEach(() => {
  usePortfolioStore.getState().closeAllWindows();
  usePortfolioStore.getState().resetClimate();
});

async function runAxe(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      // jsdom cannot compute layout/colors; contrast is verified separately
      // via design-token review and the Playwright/Lighthouse stage (commit 10).
      'color-contrast': { enabled: false },
    },
  });
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`,
  );
}

describe('axe-core accessibility scans (2D mode)', () => {
  it.each([
    ['home', '#/'],
    ['about', '#/about'],
    ['experience', '#/experience'],
    ['projects', '#/projects'],
  ])('renders the %s zone without axe violations', async (_name, hash) => {
    window.location.hash = hash;
    const { container } = render(<App />);
    const violations = await runAxe(container);
    expect(violations).toEqual([]);
  });

  it('renders the climate zone (heatmap, table, selector, legend) without axe violations', async () => {
    window.location.hash = '#/climate';
    const { container } = render(<App />);
    // Wait for the loaded state so the canvas + sr-only table are scanned too.
    await screen.findByRole('img', { name: /Historical weather heatmap/ });
    expect(screen.getByLabelText('Select Year')).toBeInTheDocument();
    expect(screen.getByText('Hottest day on record')).toBeInTheDocument();
    const violations = await runAxe(container);
    expect(violations).toEqual([]);
  });

  it('renders an open About desktop window without axe violations', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/about';
    const { container } = render(<App />);
    await user.click(screen.getByRole('button', { name: /Bio/ }));
    await screen.findByRole('dialog', { name: 'Bio window' });
    const violations = await runAxe(container);
    expect(violations).toEqual([]);
  });

  it('hides the background shell while a modal dialog is open (and restores it)', async () => {
    const user = userEvent.setup();
    const post = POSTS[0]!;
    window.location.hash = '#/experience';
    usePortfolioStore.setState({ selectedPostId: postId(post) });
    const { container } = render(<App />);

    const dialog = await screen.findByRole('dialog', {
      name: new RegExp(post.title),
    });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const shell = container.querySelector('.app-shell') as HTMLElement;
    expect(shell).toHaveAttribute('inert');
    expect(shell).toHaveAttribute('aria-hidden', 'true');

    const violations = await runAxe(container);
    expect(violations).toEqual([]);

    await user.click(
      screen.getByRole('button', {
        name: `Close details for ${post.title}`,
      }),
    );
    expect(shell).not.toHaveAttribute('inert');
    expect(shell).not.toHaveAttribute('aria-hidden');
  });
});

describe('axe-core accessibility scans (forced 3D over canvas)', () => {
  /**
   * App's capability effect forces 2D in jsdom (no WebGL2). Flip mode AFTER
   * mount so the forced-3D DOM path is scanned exactly as it is in a browser.
   */
  function renderForced3d(
    hash: string,
    dialogState: Record<string, unknown> = {},
  ) {
    window.location.hash = hash;
    const rendered = render(<App />);
    act(() =>
      usePortfolioStore.setState({
        mode: '3d',
        pointerFine: true,
        desktopOpen: false,
        selectedPostId: null,
        selectedProjectId: null,
        climatePanelOpen: false,
        menuHoverRoute: null,
        menuFocusRoute: null,
        ...dialogState,
      }),
    );
    return rendered;
  }

  it.each([
    ['home', '#/'],
    ['about', '#/about'],
    ['experience', '#/experience'],
    ['projects', '#/projects'],
  ])('keeps the sr-only DOM menu accessible in 3D: %s', async (_name, hash) => {
    const { container } = renderForced3d(hash);
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    expect(within(menu).getAllByRole('link')).toHaveLength(7);
    expect(await runAxe(container)).toEqual([]);
  });

  it('scans a dialog open over the canvas (book detail)', async () => {
    const { container } = renderForced3d('#/experience', {
      selectedPostId: postId(POSTS[0]!),
    });
    await screen.findByRole('dialog');
    expect(await runAxe(container)).toEqual([]);
  });

  it('scans a dialog open over the canvas (monitor desktop)', async () => {
    const { container } = renderForced3d('#/about', { desktopOpen: true });
    await screen.findByRole('dialog', { name: 'About desktop — full screen' });
    expect(await runAxe(container)).toEqual([]);
  });

  it('scans a dialog open over the canvas (climate panel)', async () => {
    const { container } = renderForced3d('#/climate', {
      climatePanelOpen: true,
    });
    await screen.findByRole('dialog');
    expect(await runAxe(container)).toEqual([]);
  });
});
