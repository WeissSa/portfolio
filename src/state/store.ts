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
  setMode: (mode: Mode) => void;
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

export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
  mode: '2d',
  setMode: (mode) => set({ mode }),
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
  selectPost: (selectedPostId) => set({ selectedPostId }),
  hoveredPostId: null,
  setHoveredPost: (hoveredPostId) => set({ hoveredPostId }),
  pointerFine: false,
  setPointerFine: (pointerFine) => set({ pointerFine }),
}));
