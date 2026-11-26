/**
 * Unified detail panel contract (UX fix pass 2026-11-25, reverses polish(c)).
 *
 * There is exactly ONE readable DOM panel for every detail surface and every
 * mode: fine-pointer live 3D, 2D, coarse pointer, reduced motion and a scene
 * that never drew. It is visible, modal, scrollable and focus-trapped; the
 * in-world object keeps its open animation but never paints truncated prose.
 * These tests assert that contract headlessly; real-browser readability,
 * scrollability and framing are asserted by scripts/qa/detail-mirror.spec.ts.
 */
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from './helpers';
import { POSTS, PROJECTS, postId } from '../src/content/posts';
import { isDiegeticDetail } from '../src/lib/detail-mode';
import { usePortfolioStore } from '../src/state/store';
import { PostDetailOverlay } from '../src/ui/PostDetailOverlay';
import { ProjectDetailOverlay } from '../src/ui/ProjectDetailOverlay';
import { DesktopZoom } from '../src/ui/DesktopZoom';
import { ClimateProjectorPanel } from '../src/ui/ClimateProjectorPanel';

/** Fine-pointer LIVE 3D — the only mode with a camera detail close-up. */
function live3d(): void {
  usePortfolioStore.setState({
    mode: '3d',
    sceneReady: true,
    pointerFine: true,
  });
}

/** The F2 focus proxy App renders while a scene pick is available. */
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

describe('isDiegeticDetail (camera-closeup gate only)', () => {
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

describe('one visible, readable panel in live 3D', () => {
  it('shows full book content in a modal dialog with a close control', async () => {
    const post = POSTS[0]!;
    installTrigger();
    live3d();
    usePortfolioStore.setState({ selectedPostId: postId(post) });
    renderWithProviders(<PostDetailOverlay />);

    const dialog = await screen.findByRole('dialog', {
      name: new RegExp(post.title),
    });
    expect(dialog).toHaveClass('detail-mirror');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('data-detail-surface', 'book');
    expect(dialog).toHaveTextContent(post.title);
    expect(dialog.querySelector('.detail-mirror__body')).not.toBeNull();
    // No separate Mantine modal / dual code path.
    expect(document.querySelector('.post-detail-overlay')).toBeNull();
    expect(document.querySelector('.post-detail-backdrop')).toBeNull();
    expect(
      within(dialog).getByRole('button', {
        name: `Close details for ${post.title}`,
      }),
    ).toBeInTheDocument();
  });

  it('F1: focus in the panel lights the in-world object; blur clears it', async () => {
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

  it('uses the same panel for case, CRT and projector surfaces', async () => {
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

describe('the SAME panel in every non-picking fallback', () => {
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
    it(`book panel is visible in ${label}`, async () => {
      const post = POSTS[0]!;
      apply();
      usePortfolioStore.setState({ selectedPostId: postId(post) });
      renderWithProviders(<PostDetailOverlay />);

      const dialog = await screen.findByRole('dialog', {
        name: new RegExp(post.title),
      });
      expect(dialog).toHaveClass('detail-mirror');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(document.querySelector('.post-detail-overlay')).toBeNull();
      expect(document.querySelector('.detail-panel-scrim')).not.toBeNull();
    });
  }

  it('reduced-motion 3D keeps the same panel', async () => {
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
      expect(dialog).toHaveClass('detail-mirror');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(document.querySelector('.post-detail-overlay')).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('case and projector fallbacks share it too', async () => {
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
    expect(document.querySelector('.project-detail-overlay')).toBeNull();
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

describe('live ↔ fallback handover while a detail is open', () => {
  it('keeps the identical panel and restores the F2 trigger on close', async () => {
    const trigger = installTrigger();
    const post = POSTS[0]!;
    live3d();
    usePortfolioStore.setState({ selectedPostId: postId(post) });
    const view = renderWithProviders(<PostDetailOverlay />);

    const panel = await screen.findByRole('dialog', {
      name: new RegExp(post.title),
    });
    expect(panel).toHaveClass('detail-mirror');

    act(() => usePortfolioStore.setState({ mode: '2d' }));
    const samePanel = await screen.findByRole('dialog', {
      name: new RegExp(post.title),
    });
    expect(samePanel).toBe(panel); // NO unmount/remount, one code path
    expect(document.querySelector('.post-detail-overlay')).toBeNull();

    act(() => live3d());
    expect(await screen.findByRole('dialog')).toBe(panel);

    await userEvent.keyboard('{Escape}');
    expect(usePortfolioStore.getState().selectedPostId).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
    view.unmount();
  });
});
