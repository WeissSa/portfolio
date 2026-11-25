/**
 * polish(c) — diegetic in-world detail with an a11y-only DOM mirror.
 *
 * Critical contract: in fine-pointer LIVE 3D the detail DOM is visually hidden
 * (in the a11y tree + tab order, revealed only by real keyboard focus), while
 * EVERY non-picking mode keeps the ordinary visible DOM detail dialog. These
 * tests assert the shell side of that contract headlessly; pixel-level
 * "no visible dialog" is asserted by the Playwright QA spec.
 */
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from './helpers';
import { POSTS, postId } from '../src/content/posts';
import { PROJECTS } from '../src/content/posts';
import { isDiegeticDetail } from '../src/lib/detail-mode';
import { usePortfolioStore } from '../src/state/store';
import { PostDetailOverlay } from '../src/ui/PostDetailOverlay';
import { ProjectDetailOverlay } from '../src/ui/ProjectDetailOverlay';
import { DesktopZoom } from '../src/ui/DesktopZoom';
import { ClimateProjectorPanel } from '../src/ui/ClimateProjectorPanel';

/** Fine-pointer LIVE 3D — the only mode where the DOM becomes a mirror. */
function live3d(): void {
  usePortfolioStore.setState({
    mode: '3d',
    sceneReady: true,
    pointerFine: true,
  });
}

/** The F2 focus proxy App renders in diegetic mode. */
function installTrigger(): HTMLButtonElement {
  document.getElementById('detail-return')?.remove();
  const trigger = document.createElement('button');
  trigger.id = 'detail-return';
  trigger.className = 'sr-only';
  document.body.appendChild(trigger);
  trigger.focus();
  return trigger;
}

beforeEach(() => {
  usePortfolioStore.setState({
    mode: '2d',
    sceneReady: false,
    pointerFine: false,
    selectedPostId: null,
    selectedProjectId: null,
    desktopOpen: false,
    climatePanelOpen: false,
    detailMirrorFocused: false,
    openWindows: [],
  });
  document.getElementById('detail-return')?.remove();
});

describe('isDiegeticDetail (pure gate)', () => {
  const base = {
    mode: '3d' as const,
    sceneReady: true,
    pointerFine: true,
    prefersReducedMotion: false,
  };

  it('is true only for fine-pointer live 3D', () => {
    expect(isDiegeticDetail(base)).toBe(true);
  });

  it('is false in every non-picking fallback', () => {
    expect(isDiegeticDetail({ ...base, mode: '2d' })).toBe(false);
    expect(isDiegeticDetail({ ...base, sceneReady: false })).toBe(false);
    expect(isDiegeticDetail({ ...base, pointerFine: false })).toBe(false);
    expect(isDiegeticDetail({ ...base, prefersReducedMotion: true })).toBe(
      false,
    );
  });
});

describe('fine-pointer live 3D: a11y-only mirror, never a visible dialog', () => {
  it('keeps the book content in the a11y tree as a hidden mirror', async () => {
    const post = POSTS[0]!;
    const trigger = installTrigger();
    live3d();
    usePortfolioStore.setState({ selectedPostId: postId(post) });
    renderWithProviders(<PostDetailOverlay />);

    const dialog = await screen.findByRole('dialog', {
      name: new RegExp(post.title),
    });
    expect(dialog).toHaveClass('detail-mirror');
    expect(dialog).toHaveAttribute('data-detail-surface', 'book');
    // No visible Mantine dialog / backdrop in the diegetic surface.
    expect(document.querySelector('.post-detail-overlay')).toBeNull();
    expect(document.querySelector('.post-detail-backdrop')).toBeNull();
    expect(dialog).not.toHaveAttribute('aria-modal');
    // Full verbatim content survives for screen readers.
    expect(dialog).toHaveTextContent(post.title);
    expect(trigger).toHaveFocus(); // opening never auto-focuses the mirror
  });

  it('F1: keyboard focus in the mirror lights the in-world object; blur clears it', async () => {
    const post = POSTS[0]!;
    installTrigger();
    live3d();
    usePortfolioStore.setState({ selectedPostId: postId(post) });
    renderWithProviders(<PostDetailOverlay />);
    const dialog = await screen.findByRole('dialog');
    const close = within(dialog).getByRole('button', { name: /Close details/ });

    close.focus();
    await waitFor(() =>
      expect(usePortfolioStore.getState().detailMirrorFocused).toBe(true),
    );
    // Moving focus out of the mirror fires React's focusout/blur handler.
    act(() => document.getElementById('detail-return')!.focus());
    await waitFor(() =>
      expect(usePortfolioStore.getState().detailMirrorFocused).toBe(false),
    );
  });

  it('F2: Escape closes and restores focus to the 3D trigger', async () => {
    const post = POSTS[0]!;
    const trigger = installTrigger();
    live3d();
    usePortfolioStore.setState({ selectedPostId: postId(post) });
    renderWithProviders(<PostDetailOverlay />);
    await screen.findByRole('dialog');

    await userEvent.keyboard('{Escape}');
    expect(usePortfolioStore.getState().selectedPostId).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('mirrors the case, CRT and projector surfaces with distinct in-world targets', async () => {
    const project = PROJECTS[0]!;
    installTrigger();
    live3d();
    usePortfolioStore.setState({ selectedProjectId: postId(project) });
    const caseView = renderWithProviders(<ProjectDetailOverlay />);
    expect(await screen.findByRole('dialog')).toHaveAttribute(
      'data-detail-surface',
      'case',
    );
    expect(document.querySelector('.project-detail-overlay')).toBeNull();
    caseView.unmount();

    usePortfolioStore.setState({
      selectedProjectId: null,
      desktopOpen: true,
    });
    const crtView = renderWithProviders(<DesktopZoom />);
    expect(await screen.findByRole('dialog')).toHaveAttribute(
      'data-detail-surface',
      'monitor',
    );
    expect(document.querySelector('.desktop-zoom')).toBeNull();
    crtView.unmount();

    usePortfolioStore.setState({ desktopOpen: false, climatePanelOpen: true });
    const projectorView = renderWithProviders(<ClimateProjectorPanel />);
    expect(await screen.findByRole('dialog')).toHaveAttribute(
      'data-detail-surface',
      'projector',
    );
    expect(document.querySelector('.climate-projector-overlay')).toBeNull();
    projectorView.unmount();
  });
});

describe('every non-picking fallback shows the visible DOM detail', () => {
  const fallbacks: readonly [string, () => void][] = [
    ['2D', () => usePortfolioStore.setState({ mode: '2d' })],
    [
      'live 3D before the first frame',
      () => usePortfolioStore.setState({ mode: '3d', sceneReady: false }),
    ],
    [
      'coarse-pointer 3D',
      () =>
        usePortfolioStore.setState({
          mode: '3d',
          sceneReady: true,
          pointerFine: false,
        }),
    ],
  ];

  for (const [label, apply] of fallbacks) {
    it(`book dialog is visible in ${label}`, async () => {
      const post = POSTS[0]!;
      apply();
      usePortfolioStore.setState({ selectedPostId: postId(post) });
      renderWithProviders(<PostDetailOverlay />);

      const dialog = await screen.findByRole('dialog', {
        name: new RegExp(post.title),
      });
      expect(document.querySelector('.post-detail-overlay')).not.toBeNull();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(document.querySelector('.post-detail-backdrop')).not.toBeNull();
      expect(dialog).not.toHaveClass('detail-mirror');
    });
  }

  it('reduced-motion 3D keeps the visible dialog', async () => {
    const spy = vi.spyOn(window, 'matchMedia').mockImplementation(((
      query: string,
    ) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia);
    try {
      const post = POSTS[0]!;
      live3d();
      usePortfolioStore.setState({ selectedPostId: postId(post) });
      renderWithProviders(<PostDetailOverlay />);
      const dialog = await screen.findByRole('dialog', {
        name: new RegExp(post.title),
      });
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(document.querySelector('.post-detail-overlay')).not.toBeNull();
      expect(dialog).not.toHaveClass('detail-mirror');
    } finally {
      spy.mockRestore();
    }
  });

  it('case/projector dialogs remain visible when no scene ever drew', async () => {
    const project = PROJECTS[0]!;
    usePortfolioStore.setState({
      mode: '2d',
      selectedProjectId: postId(project),
    });
    renderWithProviders(<ProjectDetailOverlay />);
    expect(await screen.findByRole('dialog')).toHaveAttribute(
      'aria-modal',
      'true',
    );
    expect(document.querySelector('.project-detail-overlay')).not.toBeNull();
  });
});

describe('mirror focus state is 3D-only state', () => {
  it('is cleared when leaving 3D', () => {
    live3d();
    act(() => usePortfolioStore.getState().setDetailMirrorFocused(true));
    act(() => usePortfolioStore.getState().setMode('2d'));
    expect(usePortfolioStore.getState().detailMirrorFocused).toBe(false);
  });
});

describe('live ↔ pointer/fallback handover while a detail is open', () => {
  it('swaps mirror/dialog, keeps the content, and restores the F2 trigger', async () => {
    const trigger = installTrigger();
    const post = POSTS[0]!;
    live3d();
    usePortfolioStore.setState({ selectedPostId: postId(post) });
    const view = renderWithProviders(<PostDetailOverlay />);

    const mirror = await screen.findByRole('dialog', {
      name: new RegExp(post.title),
    });
    expect(mirror).toHaveClass('detail-mirror');
    expect(mirror).not.toHaveAttribute('aria-modal');

    // Live 3D → fallback while the book is still selected: the modal dialog
    // takes over (inert/focus-trap restored), the mirror leaves the DOM.
    act(() => usePortfolioStore.setState({ mode: '2d' }));
    const dialog = await screen.findByRole('dialog', {
      name: new RegExp(post.title),
    });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.querySelector('.post-detail-overlay')).not.toBeNull();
    expect(document.querySelector('.detail-mirror')).toBeNull();

    // Back into live fine-pointer 3D: the in-world view owns the detail again.
    act(() => live3d());
    const mirrorAgain = await screen.findByRole('dialog', {
      name: new RegExp(post.title),
    });
    expect(mirrorAgain).toHaveClass('detail-mirror');
    expect(document.querySelector('.post-detail-overlay')).toBeNull();

    await userEvent.keyboard('{Escape}');
    expect(usePortfolioStore.getState().selectedPostId).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
    view.unmount();
  });
});
