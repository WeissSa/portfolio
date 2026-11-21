import { describe, expect, it } from 'vitest';
import { usePortfolioStore } from '../src/state/store';

describe('portfolio store', () => {
  it('defaults to 2D mode and the home zone', () => {
    const state = usePortfolioStore.getState();
    expect(state.mode).toBe('2d');
    expect(state.activeZone).toBe('/');
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
