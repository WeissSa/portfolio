import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import App from '../src/App';
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
});
