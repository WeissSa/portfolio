import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import App from '../src/App';

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
});
