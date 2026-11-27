import { beforeEach, describe, expect, it } from 'vitest';
import {
  usePortfolioStore,
  detailPostId,
  detailProjectId,
} from '../src/state/store';

describe('portfolio store', () => {
  beforeEach(() => {
    window.location.hash = '';
    usePortfolioStore.setState({
      activeDetail: null,
      activeZone: '/',
      hasNavigated: false,
      hoveredPostId: null,
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
    const { openDetail, closeDetail, setHoveredPost, setPointerFine } =
      usePortfolioStore.getState();
    expect(detailPostId(usePortfolioStore.getState().activeDetail)).toBeNull();
    expect(usePortfolioStore.getState().hoveredPostId).toBeNull();
    expect(usePortfolioStore.getState().pointerFine).toBe(false);

    openDetail({ kind: 'post', id: 'gusto-software-engineer' });
    setHoveredPost('gusto-software-engineer');
    setPointerFine(true);
    const state = usePortfolioStore.getState();
    expect(detailPostId(state.activeDetail)).toBe('gusto-software-engineer');
    expect(state.hoveredPostId).toBe('gusto-software-engineer');
    expect(state.pointerFine).toBe(true);

    closeDetail();
    setHoveredPost(null);
    setPointerFine(false);
  });

  it('clears 3D-only UI state when leaving 3D mode (A3/B3)', () => {
    const { setMode } = usePortfolioStore.getState();
    setMode('3d');
    // One stale detail plus hover ids from an older session must all be
    // cleared on a 3d → 2d switch — no detail may leak into the 2D zone.
    usePortfolioStore.setState({
      activeDetail: { kind: 'post', id: 'gusto-software-engineer' },
      hoveredPostId: 'gusto-software-engineer',
      hoveredProjectId: 'dreamzzz-game-development-project',
    });
    expect(detailPostId(usePortfolioStore.getState().activeDetail)).toBe(
      'gusto-software-engineer',
    );

    setMode('2d');
    const state = usePortfolioStore.getState();
    expect(state.mode).toBe('2d');
    expect(state.activeDetail).toBeNull();
    expect(detailPostId(state.activeDetail)).toBeNull();
    expect(state.hoveredPostId).toBeNull();
    expect(detailProjectId(state.activeDetail)).toBeNull();
    expect(state.hoveredProjectId).toBeNull();
  });

  it('lets only one 3D modal own the screen at a time', () => {
    const s = () => usePortfolioStore.getState();
    usePortfolioStore.setState({ activeDetail: null, mode: '3d' });

    // Opening the projector clears the book/case dialogs and the desktop zoom.
    usePortfolioStore.setState({ activeDetail: { kind: 'about' } });
    s().openDetail({ kind: 'climate' });
    expect(s().activeDetail?.kind === 'climate').toBe(true);
    expect(detailPostId(s().activeDetail)).toBeNull();
    expect(detailProjectId(s().activeDetail)).toBeNull();
    expect(s().activeDetail?.kind === 'about').toBe(false);

    // Each of the other open actions clears climatePanelOpen in turn.
    s().openDetail({ kind: 'post', id: 'cidel' });
    expect(detailPostId(s().activeDetail)).toBe('cidel');
    expect(s().activeDetail?.kind === 'climate').toBe(false);
    s().openDetail({
      kind: 'project',
      id: 'dreamzzz-game-development-project',
    });
    expect(detailProjectId(s().activeDetail)).toBe(
      'dreamzzz-game-development-project',
    );
    expect(detailPostId(s().activeDetail)).toBeNull();
    expect(s().activeDetail?.kind === 'climate').toBe(false);
    s().openDetail({ kind: 'about' });
    expect(s().activeDetail?.kind === 'about').toBe(true);
    expect(detailProjectId(s().activeDetail)).toBeNull();
    expect(s().activeDetail?.kind === 'climate').toBe(false);

    // Closing (null/false) never resurrects another dialog.
    s().closeDetail();
    expect(detailPostId(s().activeDetail)).toBeNull();
    expect(detailProjectId(s().activeDetail)).toBeNull();
    expect(s().activeDetail?.kind === 'climate').toBe(false);
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
    const { openDetail, closeDetail, setHoveredProject } =
      usePortfolioStore.getState();
    openDetail({
      kind: 'project',
      id: 'dreamzzz-game-development-project',
    });
    setHoveredProject('dreamzzz-game-development-project');
    expect(detailProjectId(usePortfolioStore.getState().activeDetail)).toBe(
      'dreamzzz-game-development-project',
    );
    expect(usePortfolioStore.getState().hoveredProjectId).toBe(
      'dreamzzz-game-development-project',
    );

    // Picking a book closes the case dialog; closing (null) never re-opens it.
    openDetail({ kind: 'post', id: 'gusto-software-engineer' });
    expect(detailPostId(usePortfolioStore.getState().activeDetail)).toBe(
      'gusto-software-engineer',
    );
    expect(
      detailProjectId(usePortfolioStore.getState().activeDetail),
    ).toBeNull();
    closeDetail();
    expect(
      detailProjectId(usePortfolioStore.getState().activeDetail),
    ).toBeNull();

    closeDetail();
    setHoveredProject(null);
    expect(
      detailProjectId(usePortfolioStore.getState().activeDetail),
    ).toBeNull();
    expect(usePortfolioStore.getState().hoveredProjectId).toBeNull();
  });

  it('does not clear a case selection on the initial 2D gate', () => {
    usePortfolioStore.setState({
      activeDetail: {
        kind: 'project',
        id: 'dreamzzz-game-development-project',
      },
      mode: '2d',
    });
    usePortfolioStore.getState().setMode('2d');
    expect(detailProjectId(usePortfolioStore.getState().activeDetail)).toBe(
      'dreamzzz-game-development-project',
    );
  });

  it('does not clear 2D-opened detail panels on the initial 2D gate', () => {
    // App's capability effect calls setMode('2d') on mount; a detail panel
    // opened directly from the DOM must survive it (no real 3d → 2d change).
    usePortfolioStore.setState({
      activeDetail: { kind: 'post', id: 'cidel' },
      mode: '2d',
    });
    usePortfolioStore.getState().setMode('2d');
    expect(detailPostId(usePortfolioStore.getState().activeDetail)).toBe(
      'cidel',
    );
  });

  it('tracks the monitor desktop zoom separately from the book/route state', () => {
    const { openDetail, closeDetail, clear3dSelection } =
      usePortfolioStore.getState();
    closeDetail();
    expect(usePortfolioStore.getState().activeDetail?.kind === 'about').toBe(
      false,
    );
    openDetail({ kind: 'about' });
    expect(usePortfolioStore.getState().activeDetail?.kind === 'about').toBe(
      true,
    );
    // Independent of the hash route (2D #/about still works) and book ids.
    expect(usePortfolioStore.getState().activeZone).toBe('/');
    expect(detailPostId(usePortfolioStore.getState().activeDetail)).toBeNull();
    clear3dSelection();
    expect(usePortfolioStore.getState().activeDetail?.kind === 'about').toBe(
      false,
    );
  });

  it('shares the climate year across modes but clears the 3D-only panel (commit 9)', () => {
    const { setSelectedClimateYear, openDetail, closeDetail, setMode } =
      usePortfolioStore.getState();
    const originalYear = usePortfolioStore.getState().selectedClimateYear;
    setMode('3d');
    setSelectedClimateYear(2019);
    openDetail({ kind: 'climate' });
    expect(usePortfolioStore.getState().selectedClimateYear).toBe(2019);
    expect(usePortfolioStore.getState().activeDetail?.kind === 'climate').toBe(
      true,
    );

    // 3d → 2d clears the dialog but NOT the visitor's year choice.
    setMode('2d');
    let state = usePortfolioStore.getState();
    expect(state.activeDetail?.kind === 'climate').toBe(false);
    expect(state.selectedClimateYear).toBe(2019);

    // A plain 2d → 2d gate cannot clear either value.
    setMode('2d');
    state = usePortfolioStore.getState();
    expect(state.selectedClimateYear).toBe(2019);

    openDetail({ kind: 'climate' });
    closeDetail();
    expect(usePortfolioStore.getState().activeDetail?.kind === 'climate').toBe(
      false,
    );
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
