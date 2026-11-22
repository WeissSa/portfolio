import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import App from '../src/App';
import { POSTS, postId } from '../src/content/posts';
import { usePortfolioStore } from '../src/state/store';

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
