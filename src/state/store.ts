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
}

export type AboutWindowId = 'bio' | 'now' | 'hobbies' | 'skills' | 'links';

export interface PortfolioStore {
  /** Rendering mode. Stage 1 ships 2D only; 3D lands with the room commits. */
  mode: Mode;
  setMode: (mode: Mode) => void;

  activeZone: Route;
  setActiveZone: (route: Route) => void;

  climate: ClimateState;
  loadClimate: () => Promise<void>;
  resetClimate: () => void;

  /** About desktop-OS: stack of open windows, bottom → top. */
  openWindows: AboutWindowId[];
  openWindow: (id: AboutWindowId) => void;
  closeWindow: (id: AboutWindowId) => void;
  closeTopWindow: () => AboutWindowId | null;
  closeAllWindows: () => void;
}

const IDLE_CLIMATE: ClimateState = {
  status: 'idle',
  source: null,
  currentTemp: null,
  locationName: null,
  historical: {},
  error: null,
};

export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
  mode: '2d',
  setMode: (mode) => set({ mode }),

  activeZone: '/',
  setActiveZone: (activeZone) => {
    if (get().activeZone !== activeZone) {
      set({ activeZone });
    }
  },

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
}));
