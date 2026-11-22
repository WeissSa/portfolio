/**
 * Crash-on-load regression (two independent reviews of commit 5): if the R3F
 * <Canvas> throws while mounting, React must not unmount the authoritative 2D
 * shell, and a persisted "3d" override must not make every reload crash.
 */
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { MODE_STORAGE_KEY } from '../src/lib/device-tier';
import { usePortfolioStore } from '../src/state/store';

// Test stub: a child of the boundary that throws on mount, standing in for a
// WebGL2-less Canvas creation failure.
vi.mock('../src/ui/SceneLayer', () => ({
  SceneLayer: () => {
    throw new Error('Canvas creation failed (test stub)');
  },
}));

describe('SceneLayer error boundary', () => {
  beforeEach(() => {
    window.location.hash = '';
    usePortfolioStore.setState({
      mode: '2d',
      autoMode: '3d',
      activeZone: '/',
      hasNavigated: false,
    });
  });

  it('falls back to 2D and keeps the DOM shell when the scene throws', () => {
    // React reports caught boundary errors via console.error; silence it.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      localStorage.setItem(MODE_STORAGE_KEY, '3d');
      render(<App />);

      // jsdom has no WebGL2, so App's gate keeps 2D on mount. Flip to 3D
      // afterwards to force the stubbed SceneLayer to mount and throw.
      act(() => {
        usePortfolioStore.setState({ mode: '3d' });
      });

      expect(usePortfolioStore.getState().mode).toBe('2d');
      expect(localStorage.getItem(MODE_STORAGE_KEY)).toBeNull();
      // The entire 2D root (menu + zone heading) is still usable.
      expect(
        screen.getByRole('navigation', { name: 'Main menu' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 2, name: 'Sam Weiss' }),
      ).toBeVisible();
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
