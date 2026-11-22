import { create } from 'zustand';
import type { Route } from '../lib/router';
import { flatToHistorical, type HistoricalData } from '../lib/climate';
import { loadClimateData } from '../lib/climate-api';

export type Mode = '2d' | '3d';
export type ClimateStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ClimateSource = 'live' | 'cache' | 'snapshot' | null;

export interface ClimateState {
  status: ClimateStatus;
  source: ClimateSource;
  currentTemp: number | null;
  locationName: string | null;
  historical: HistoricalData;
  error: string | null;
  /** When the displayed data was collected (live/cache) or generated (snapshot). */
  fetchedAt: number | null;
  /** True when an expired localStorage entry was the only data available. */
  isStale: boolean;
}

export type AboutWindowId = 'bio' | 'now' | 'hobbies' | 'skills' | 'links';

export interface PortfolioStore {
  /** Rendering mode. Starts in 2D; capability detection may opt into 3D. */
  mode: Mode;
  /**
   * Set the rendering mode. Leaving 3D clears all 3D-only UI state (book/case
   * highlight + selection and the monitor's desktop zoom) so DOM cards never
   * stay highlighted and a stale desktop overlay cannot leak into 2D (A3/B3).
   * Only a real 3d → 2d transition clears: the initial 2d gate must not wipe
   * a detail panel opened directly from the 2D DOM.
   */
  setMode: (mode: Mode) => void;
  /** Explicit teardown of 3D-only UI state (also used by setMode). */
  clear3dSelection: () => void;
  /**
   * Capability-derived automatic mode (no manual override). The toggle's
   * "Auto" option restores this after clearing a stuck override; safe default
   * is 2D until App runs detection.
   */
  autoMode: Mode;
  setAutoMode: (mode: Mode) => void;

  activeZone: Route;
  setActiveZone: (route: Route) => void;
  /**
   * Align the store with the landing route on the first mount (deep links,
   * legacy 404 redirects) WITHOUT counting it as navigation. Calls to this
   * never flip `hasNavigated`, so the initial paint keeps `app-initial` and
   * the cut-in only plays for genuine in-app navigation.
   */
  syncInitialRoute: (route: Route) => void;
  /**
   * False until the first real zone change. The initial mount keeps the
   * `app-initial` class so cut-in animations are suppressed and the React UI
   * appears exactly like the styled static mirror it replaces (no frame-0
   * jump). Flips true only when setActiveZone receives a different zone.
   */
  hasNavigated: boolean;

  climate: ClimateState;
  loadClimate: () => Promise<void>;
  resetClimate: () => void;

  /** About desktop-OS: stack of open windows, bottom → top. */
  openWindows: AboutWindowId[];
  openWindow: (id: AboutWindowId) => void;
  closeWindow: (id: AboutWindowId) => void;
  closeTopWindow: () => AboutWindowId | null;
  closeAllWindows: () => void;

  /* Library / Experience (commit 6): a pickable 3D book writes these ids; the
   * SAME accessible DOM components read them, so content is never canvas-only. */

  /** Selected book → opens the shared DOM detail overlay. Null = closed. */
  selectedPostId: string | null;
  selectPost: (id: string | null) => void;
  /** Hovered book → highlights the matching DOM card (visual parity). */
  hoveredPostId: string | null;
  setHoveredPost: (id: string | null) => void;
  /** Fine pointer present: enables R3F picking; keyboard users use the DOM. */
  pointerFine: boolean;
  setPointerFine: (fine: boolean) => void;

  /* Desk / About desktop zoom (commit 7): the monitor sets this flag; App
   * renders the SAME AboutDesktop DOM full-screen, and CameraRig flies to the
   * monitor close-up. Separate from selectedPostId / hash route so 2D #/about
   * keeps working. */
  /** True while the 3D monitor's full-screen desktop-OS overlay is open. */
  desktopOpen: boolean;
  openDesktop: () => void;
  closeDesktop: () => void;

  /* Game cases / Projects (commit 8): a picked 3D case writes its id here;
   * the SAME PostCard used by the 2D Projects list renders in a DOM dialog.
   * Keys are post ids (PROJECTS is a subset of POSTS), so content lookup and
   * data-project-id parity need no second id scheme. */
  /** Selected game case → opens the shared DOM project detail dialog. */
  selectedProjectId: string | null;
  selectProject: (id: string | null) => void;
  /** Hovered case → highlights the matching 2D project card (visual parity). */
  hoveredProjectId: string | null;
  setHoveredProject: (id: string | null) => void;
}

const IDLE_CLIMATE: ClimateState = {
  status: 'idle',
  source: null,
  currentTemp: null,
  locationName: null,
  historical: {},
  error: null,
  fetchedAt: null,
  isStale: false,
};

/** 3D-only UI state that must not survive a switch back to 2D (A3/B3). */
const CLEARED_3D_UI = {
  selectedPostId: null,
  hoveredPostId: null,
  desktopOpen: false,
  selectedProjectId: null,
  hoveredProjectId: null,
};

export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
  mode: '2d',
  setMode: (mode) =>
    set((state) => ({
      mode,
      ...(state.mode === '3d' && mode === '2d' ? CLEARED_3D_UI : {}),
    })),
  clear3dSelection: () => set(CLEARED_3D_UI),
  autoMode: '2d',
  setAutoMode: (autoMode) => set({ autoMode }),

  activeZone: '/',
  hasNavigated: false,
  setActiveZone: (activeZone) => {
    if (get().activeZone !== activeZone) {
      // A real zone change: mark that we've navigated so the `app-initial`
      // class drops and subsequent views play the cut-in animation.
      set({ activeZone, hasNavigated: true });
    }
  },
  // The landing-route sync must not flip `hasNavigated`: arriving at a deep
  // link (e.g. #/climate from the legacy 404 redirect) is not a navigation.
  syncInitialRoute: (activeZone) => set({ activeZone }),

  climate: IDLE_CLIMATE,
  loadClimate: async () => {
    const { climate } = get();
    if (climate.status === 'loading' || climate.status === 'ready') {
      return;
    }
    set({ climate: { ...IDLE_CLIMATE, status: 'loading' } });
    const outcome = await loadClimateData();
    if (outcome.status === 'error') {
      set({
        climate: {
          ...IDLE_CLIMATE,
          status: 'error',
          error: outcome.error,
        },
      });
      return;
    }
    set({
      climate: {
        status: 'ready',
        source: outcome.status,
        currentTemp: outcome.data.currentTemp,
        locationName: outcome.data.locationName,
        historical: flatToHistorical(outcome.data.flat),
        error: null,
        fetchedAt: outcome.fetchedAt,
        isStale: outcome.stale,
      },
    });
  },
  resetClimate: () => set({ climate: IDLE_CLIMATE }),

  openWindows: [],
  openWindow: (id) =>
    set((state) => ({
      openWindows: state.openWindows.includes(id)
        ? state.openWindows
        : [...state.openWindows, id],
    })),
  closeWindow: (id) =>
    set((state) => ({
      openWindows: state.openWindows.filter((open) => open !== id),
    })),
  closeTopWindow: () => {
    const { openWindows } = get();
    const top = openWindows[openWindows.length - 1] ?? null;
    if (top) {
      set({ openWindows: openWindows.slice(0, -1) });
    }
    return top;
  },
  closeAllWindows: () => set({ openWindows: [] }),

  selectedPostId: null,
  // Picking a book and picking a case are mutually exclusive: only one modal
  // detail dialog may own the screen. Closing (null) never touches the other
  // selection, so a close handler cannot resurrect a different detail view.
  selectPost: (selectedPostId) =>
    set(
      selectedPostId
        ? { selectedPostId, selectedProjectId: null }
        : { selectedPostId },
    ),
  hoveredPostId: null,
  setHoveredPost: (hoveredPostId) => set({ hoveredPostId }),
  pointerFine: false,
  setPointerFine: (pointerFine) => set({ pointerFine }),

  desktopOpen: false,
  openDesktop: () => set({ desktopOpen: true }),
  closeDesktop: () => set({ desktopOpen: false }),

  selectedProjectId: null,
  selectProject: (selectedProjectId) =>
    set(
      selectedProjectId
        ? { selectedProjectId, selectedPostId: null }
        : { selectedProjectId },
    ),
  hoveredProjectId: null,
  setHoveredProject: (hoveredProjectId) => set({ hoveredProjectId }),
}));
