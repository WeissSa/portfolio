/**
 * polish(c) forward-Tab contract (the regression behind the old QA hack):
 * `#detail-return` is the DOM proxy every canvas pick focuses. It MUST precede
 * the overlays in App's DOM so a natural forward Tab lands in the open a11y
 * mirror. The old spec used 40 Shift+Tab presses to wrap around from the menu.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { POSTS, PROJECTS, postId } from '../src/content/posts';
import { type Route } from '../src/lib/router';
import { usePortfolioStore } from '../src/state/store';

// jsdom has no WebGL; the lazy Canvas is a marker so the shell's real tab order
// is exercised exactly as in the browser.
vi.mock('../src/ui/SceneLayer', () => ({
  SceneLayer: () => <div data-testid="scene-layer-stub" aria-hidden="true" />,
}));

beforeEach(() => {
  usePortfolioStore.getState().closeAllWindows();
  usePortfolioStore.getState().resetClimate();
});

function openDiegetic(hash: string, state: Record<string, unknown>): void {
  window.location.hash = hash;
  render(<App />);
  act(() =>
    usePortfolioStore.setState({
      activeDetail: null,
      mode: '3d',
      sceneReady: true,
      pointerFine: true,
      activeZone: (hash === '#/' ? '/' : hash.replace('#', '')) as Route,
      ...state,
    }),
  );
}

async function proxyTabReachesMirror(
  surface: string,
  namePattern: RegExp,
): Promise<void> {
  const user = userEvent.setup();
  const mirror = await screen.findByRole('dialog', { name: namePattern });
  const proxy = document.getElementById('detail-return') as HTMLButtonElement;
  expect(proxy).toBeTruthy();
  // Real DOM order: the proxy precedes the mirror, so forward Tab — not a
  // Shift+Tab wrap-around — is the path from trigger into the detail.
  expect(
    proxy.compareDocumentPosition(mirror) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  proxy.focus();
  expect(proxy).toHaveFocus();
  await user.tab();
  // One forward Tab from the proxy reaches the single dialog's Close button.
  const close = within(mirror).getByRole('button', { name: /Close/ });
  await waitFor(() => expect(close).toHaveFocus());
  // The scrollable body follows Close in DOM order and is focused on open, so
  // wheel AND keyboard scrolling work immediately, without hunting for a Tab.
  await user.tab();
  const body = within(mirror).getByRole('region', { name: /details$/ });
  await waitFor(() => expect(body).toHaveFocus());
  expect(mirror).toHaveClass('detail-mirror');
  expect(mirror).toHaveAttribute('data-detail-surface', surface);
}

const surfaces: readonly [
  string,
  string,
  Record<string, unknown>,
  RegExp,
  string,
][] = [
  [
    'book',
    '#/experience',
    { activeDetail: { kind: 'post', id: postId(POSTS[0]!) } },
    new RegExp(POSTS[0]!.title),
    'book',
  ],
  [
    'case',
    '#/projects',
    { activeDetail: { kind: 'project', id: postId(PROJECTS[0]!) } },
    new RegExp(PROJECTS[0]!.title),
    'case',
  ],
  [
    'monitor',
    '#/about',
    { activeDetail: { kind: 'about' } },
    /About Sam/,
    'monitor',
  ],
  [
    'projector',
    '#/climate',
    { activeDetail: { kind: 'climate' } },
    /Details/,
    'projector',
  ],
];

describe('natural forward Tab from the F2 trigger into the detail mirror', () => {
  it.each(surfaces)(
    'reaches the %s mirror with one forward Tab',
    async (_name, hash, state, namePattern, surface) => {
      openDiegetic(hash, state);
      await proxyTabReachesMirror(surface, namePattern);
    },
  );

  it('works when the detail was opened from a DOM card/button, not a canvas pick', async () => {
    const user = userEvent.setup();
    openDiegetic('#/climate', {});
    await user.click(
      screen.getByRole('button', { name: 'View climate details' }),
    );
    await proxyTabReachesMirror('projector', /Details/);
  });
});
