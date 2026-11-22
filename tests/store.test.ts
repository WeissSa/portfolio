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
      selectedProjectId: null,
      hoveredProjectId: null,
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
    const { setMode } = usePortfolioStore.getState();
    setMode('3d');
    // Inject a stale multi-modal pair directly: the open actions now enforce
    // the one-modal invariant (tested separately), but a stale combination
    // from an older session must still be fully cleared on a 3d → 2d switch.
    usePortfolioStore.setState({
      selectedPostId: 'gusto-software-engineer',
      hoveredPostId: 'gusto-software-engineer',
      selectedProjectId: 'dreamzzz-game-development-project',
      hoveredProjectId: 'dreamzzz-game-development-project',
      desktopOpen: true,
      climatePanelOpen: true,
    });
    expect(usePortfolioStore.getState().desktopOpen).toBe(true);
    expect(usePortfolioStore.getState().climatePanelOpen).toBe(true);
    expect(usePortfolioStore.getState().selectedPostId).not.toBeNull();
    expect(usePortfolioStore.getState().selectedProjectId).not.toBeNull();

    setMode('2d');
    const state = usePortfolioStore.getState();
    expect(state.mode).toBe('2d');
    expect(state.selectedPostId).toBeNull();
    expect(state.hoveredPostId).toBeNull();
    expect(state.selectedProjectId).toBeNull();
    expect(state.hoveredProjectId).toBeNull();
    expect(state.desktopOpen).toBe(false);
    expect(state.climatePanelOpen).toBe(false);
  });

  it('lets only one 3D modal own the screen at a time', () => {
    const s = () => usePortfolioStore.getState();
    usePortfolioStore.setState({
      mode: '3d',
      selectedPostId: null,
      selectedProjectId: null,
      desktopOpen: false,
      climatePanelOpen: false,
    });

    // Opening the projector clears the book/case dialogs and the desktop zoom.
    usePortfolioStore.setState({
      selectedPostId: 'gusto-software-engineer',
      selectedProjectId: 'dreamzzz-game-development-project',
      desktopOpen: true,
    });
    s().openClimatePanel();
    expect(s().climatePanelOpen).toBe(true);
    expect(s().selectedPostId).toBeNull();
    expect(s().selectedProjectId).toBeNull();
    expect(s().desktopOpen).toBe(false);

    // Each of the other open actions clears climatePanelOpen in turn.
    s().selectPost('cidel');
    expect(s().selectedPostId).toBe('cidel');
    expect(s().climatePanelOpen).toBe(false);
    s().selectProject('dreamzzz-game-development-project');
    expect(s().selectedProjectId).toBe('dreamzzz-game-development-project');
    expect(s().selectedPostId).toBeNull();
    expect(s().climatePanelOpen).toBe(false);
    s().openDesktop();
    expect(s().desktopOpen).toBe(true);
    expect(s().selectedProjectId).toBeNull();
    expect(s().climatePanelOpen).toBe(false);

    // Closing (null/false) never resurrects another dialog.
    s().closeDesktop();
    expect(s().selectedPostId).toBeNull();
    expect(s().selectedProjectId).toBeNull();
    expect(s().climatePanelOpen).toBe(false);
  });

  it('clearSceneHover resets hover ids and the body cursor', () => {
    usePortfolioStore.setState({
      hoveredPostId: 'gusto-software-engineer',
      hoveredProjectId: 'dreamzzz-game-development-project',
    });
    document.body.style.cursor = 'pointer';
    usePortfolioStore.getState().clearSceneHover();
    expect(usePortfolioStore.getState().hoveredPostId).toBeNull();
    expect(usePortfolioStore.getState().hoveredProjectId).toBeNull();
    expect(document.body.style.cursor).toBe('');
  });

  it('tracks case selection/hover and keeps book/case dialogs mutually exclusive (commit 8)', () => {
    const { selectPost, selectProject, setHoveredProject } =
      usePortfolioStore.getState();
    selectProject('dreamzzz-game-development-project');
    setHoveredProject('dreamzzz-game-development-project');
    expect(usePortfolioStore.getState().selectedProjectId).toBe(
      'dreamzzz-game-development-project',
    );
    expect(usePortfolioStore.getState().hoveredProjectId).toBe(
      'dreamzzz-game-development-project',
    );

    // Picking a book closes the case dialog; closing (null) never re-opens it.
    selectPost('gusto-software-engineer');
    expect(usePortfolioStore.getState().selectedPostId).toBe(
      'gusto-software-engineer',
    );
    expect(usePortfolioStore.getState().selectedProjectId).toBeNull();
    selectPost(null);
    expect(usePortfolioStore.getState().selectedProjectId).toBeNull();

    selectProject(null);
    setHoveredProject(null);
    expect(usePortfolioStore.getState().selectedProjectId).toBeNull();
    expect(usePortfolioStore.getState().hoveredProjectId).toBeNull();
  });

  it('does not clear a case selection on the initial 2D gate', () => {
    usePortfolioStore.setState({
      mode: '2d',
      selectedProjectId: 'dreamzzz-game-development-project',
    });
    usePortfolioStore.getState().setMode('2d');
    expect(usePortfolioStore.getState().selectedProjectId).toBe(
      'dreamzzz-game-development-project',
    );
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

  it('shares the climate year across modes but clears the 3D-only panel (commit 9)', () => {
    const {
      setSelectedClimateYear,
      openClimatePanel,
      closeClimatePanel,
      setMode,
    } = usePortfolioStore.getState();
    const originalYear = usePortfolioStore.getState().selectedClimateYear;
    setMode('3d');
    setSelectedClimateYear(2019);
    openClimatePanel();
    expect(usePortfolioStore.getState().selectedClimateYear).toBe(2019);
    expect(usePortfolioStore.getState().climatePanelOpen).toBe(true);

    // 3d → 2d clears the dialog but NOT the visitor's year choice.
    setMode('2d');
    let state = usePortfolioStore.getState();
    expect(state.climatePanelOpen).toBe(false);
    expect(state.selectedClimateYear).toBe(2019);

    // A plain 2d → 2d gate cannot clear either value.
    setMode('2d');
    state = usePortfolioStore.getState();
    expect(state.selectedClimateYear).toBe(2019);

    openClimatePanel();
    closeClimatePanel();
    expect(usePortfolioStore.getState().climatePanelOpen).toBe(false);
    setSelectedClimateYear(originalYear);
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
