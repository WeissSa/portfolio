/**
 * Scene readiness is a LIVE signal, not a mode flag (owner bug 2026-11-24).
 * The 3D layout / sr-only menu / grade overlay must turn on only after the
 * Canvas issues a frame and turn off again on WebGL context loss, unmount or a
 * warm-start Canvas going inactive.
 */
import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from './helpers';
import { usePortfolioStore } from '../src/state/store';
import { SceneLayer } from '../src/ui/SceneLayer';

const harness = vi.hoisted(() => ({
  onReady: undefined as ((live: boolean) => void) | undefined,
}));

vi.mock('../src/scene/Room', () => ({
  default: ({ onReady }: { onReady?: (live: boolean) => void }) => {
    harness.onReady = onReady;
    return <div data-testid="room-stub" />;
  },
}));

beforeEach(() => {
  harness.onReady = undefined;
  usePortfolioStore.getState().setSceneReady(false);
});

describe('SceneLayer readiness gating', () => {
  it('publishes readiness only after the Canvas reports a drawn frame', async () => {
    renderWithProviders(<SceneLayer quality="desktop" active />);
    expect(usePortfolioStore.getState().sceneReady).toBe(false);
    // Room is React.lazy: wait for the mocked module to resolve and mount.
    await screen.findByTestId('room-stub');
    expect(harness.onReady).toBeDefined();

    act(() => harness.onReady?.(true));
    expect(usePortfolioStore.getState().sceneReady).toBe(true);

    // SceneReadySignal's webglcontextlost handler calls onReady(false).
    act(() => harness.onReady?.(false));
    expect(usePortfolioStore.getState().sceneReady).toBe(false);
  });

  it('revokes readiness when a warm Canvas goes inactive or unmounts', async () => {
    const view = renderWithProviders(<SceneLayer quality="desktop" active />);
    await screen.findByTestId('room-stub');
    act(() => harness.onReady?.(true));
    expect(usePortfolioStore.getState().sceneReady).toBe(true);

    view.rerender(<SceneLayer quality="desktop" active={false} />);
    expect(usePortfolioStore.getState().sceneReady).toBe(false);

    view.unmount();
    expect(usePortfolioStore.getState().sceneReady).toBe(false);
  });
});
