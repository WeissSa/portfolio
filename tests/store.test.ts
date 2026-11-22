import { beforeEach, describe, expect, it } from 'vitest';
import { usePortfolioStore } from '../src/state/store';

describe('portfolio store', () => {
  beforeEach(() => {
    window.location.hash = '';
    usePortfolioStore.setState({
      activeZone: '/',
      hasNavigated: false,
      selectedPostId: null,
      hoveredPostId: null,
      desktopOpen: false,
    });
  });

  it('defaults to 2D mode and the home zone', () => {
    const state = usePortfolioStore.getState();
    expect(state.mode).toBe('2d');
    expect(state.activeZone).toBe('/');
    expect(state.hasNavigated).toBe(false);
  });

  it('tracks mode and zone changes', () => {
    const { setMode, setActiveZone } = usePortfolioStore.getState();
    setMode('3d');
    setActiveZone('/climate');
    expect(usePortfolioStore.getState().mode).toBe('3d');
    expect(usePortfolioStore.getState().activeZone).toBe('/climate');
    setMode('2d');
    setActiveZone('/');
  });

  it('syncs the landing route without counting it as navigation', () => {
    usePortfolioStore.getState().syncInitialRoute('/climate');
    const state = usePortfolioStore.getState();
    expect(state.activeZone).toBe('/climate');
    expect(state.hasNavigated).toBe(false);
  });

  it('flips hasNavigated only when the zone actually changes', () => {
    const { setActiveZone } = usePortfolioStore.getState();

    // Same zone (e.g. App's initial route sync on mount): no navigation.
    setActiveZone('/');
    expect(usePortfolioStore.getState().hasNavigated).toBe(false);

    // A real zone change marks the first navigation.
    setActiveZone('/about');
    expect(usePortfolioStore.getState().hasNavigated).toBe(true);
  });

  it('tracks book selection, hover and fine-pointer state (commit 6)', () => {
    const { selectPost, setHoveredPost, setPointerFine } =
      usePortfolioStore.getState();
    expect(usePortfolioStore.getState().selectedPostId).toBeNull();
    expect(usePortfolioStore.getState().hoveredPostId).toBeNull();
    expect(usePortfolioStore.getState().pointerFine).toBe(false);

    selectPost('gusto-software-engineer');
    setHoveredPost('gusto-software-engineer');
    setPointerFine(true);
    const state = usePortfolioStore.getState();
    expect(state.selectedPostId).toBe('gusto-software-engineer');
    expect(state.hoveredPostId).toBe('gusto-software-engineer');
    expect(state.pointerFine).toBe(true);

    selectPost(null);
    setHoveredPost(null);
    setPointerFine(false);
  });

  it('clears 3D-only UI state when leaving 3D mode (A3/B3)', () => {
    const { setMode, selectPost, setHoveredPost, openDesktop } =
      usePortfolioStore.getState();
    setMode('3d');
    selectPost('gusto-software-engineer');
    setHoveredPost('gusto-software-engineer');
    openDesktop();
    expect(usePortfolioStore.getState().desktopOpen).toBe(true);
    expect(usePortfolioStore.getState().selectedPostId).not.toBeNull();

    setMode('2d');
    const state = usePortfolioStore.getState();
    expect(state.mode).toBe('2d');
    expect(state.selectedPostId).toBeNull();
    expect(state.hoveredPostId).toBeNull();
    expect(state.desktopOpen).toBe(false);
  });

  it('does not clear 2D-opened detail panels on the initial 2D gate', () => {
    // App's capability effect calls setMode('2d') on mount; a detail panel
    // opened directly from the DOM must survive it (no real 3d → 2d change).
    usePortfolioStore.setState({ mode: '2d', selectedPostId: 'cidel' });
    usePortfolioStore.getState().setMode('2d');
    expect(usePortfolioStore.getState().selectedPostId).toBe('cidel');
  });

  it('tracks the monitor desktop zoom separately from the book/route state', () => {
    const { openDesktop, closeDesktop, clear3dSelection } =
      usePortfolioStore.getState();
    closeDesktop();
    expect(usePortfolioStore.getState().desktopOpen).toBe(false);
    openDesktop();
    expect(usePortfolioStore.getState().desktopOpen).toBe(true);
    // Independent of the hash route (2D #/about still works) and book ids.
    expect(usePortfolioStore.getState().activeZone).toBe('/');
    expect(usePortfolioStore.getState().selectedPostId).toBeNull();
    clear3dSelection();
    expect(usePortfolioStore.getState().desktopOpen).toBe(false);
  });

  it('keeps the About window stack ordered and deduplicated', () => {
    const { openWindow, closeWindow, closeTopWindow, closeAllWindows } =
      usePortfolioStore.getState();
    closeAllWindows();

    openWindow('bio');
    openWindow('now');
    openWindow('bio'); // already open — no duplicate
    expect(usePortfolioStore.getState().openWindows).toEqual(['bio', 'now']);

    expect(closeTopWindow()).toBe('now');
    expect(usePortfolioStore.getState().openWindows).toEqual(['bio']);

    closeWindow('bio');
    expect(usePortfolioStore.getState().openWindows).toEqual([]);
    expect(closeTopWindow()).toBeNull();
    closeAllWindows();
  });
});
