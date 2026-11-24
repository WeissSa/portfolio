/**
 * Round-3 review: a diegetic HOME control must be reachable from every zone
 * without Tab. It lives inside the R3F canvas (camera-parented), never as a
 * floating DOM overlay, and keeps the DOM menu as the a11y/keyboard path.
 */
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import type * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePortfolioStore } from '../src/state/store';
import { HomeControl } from '../src/scene/HomeControl';

beforeEach(() => {
  window.location.hash = '';
  usePortfolioStore.setState({
    mode: '3d',
    activeZone: '/',
    pointerFine: true,
  });
  document.body.style.cursor = '';
});

describe('in-world HOME control', () => {
  it('renders in a zone, navigates home on pick and hides at home', async () => {
    act(() => usePortfolioStore.setState({ activeZone: '/experience' }));
    const renderer = await ReactThreeTestRenderer.create(<HomeControl />, {
      frameloop: 'never',
    });
    const controls = () =>
      renderer.scene.findAll(
        (node) =>
          node.props.name === 'diegetic-home-control' ||
          (node.instance as THREE.Object3D | undefined)?.name ===
            'diegetic-home-control',
      );
    expect(controls()).toHaveLength(1);
    expect(controls()[0]!.props.position).toEqual([-0.62, -0.36, -1.1]);

    const stopPropagation = vi.fn();
    act(() => controls()[0]!.props.onClick({ stopPropagation }));
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#/');

    act(() => usePortfolioStore.setState({ activeZone: '/' }));
    expect(controls()).toHaveLength(0);
    await renderer.unmount();
  });

  it('stays hidden for coarse pointers and in 2D', async () => {
    act(() =>
      usePortfolioStore.setState({
        activeZone: '/climate',
        pointerFine: false,
      }),
    );
    const coarse = await ReactThreeTestRenderer.create(<HomeControl />, {
      frameloop: 'never',
    });
    expect(
      coarse.scene.findAll(
        (node) => node.props.name === 'diegetic-home-control',
      ),
    ).toHaveLength(0);
    await coarse.unmount();

    act(() => usePortfolioStore.setState({ mode: '2d', pointerFine: true }));
    const flat = await ReactThreeTestRenderer.create(<HomeControl />, {
      frameloop: 'never',
    });
    expect(
      flat.scene.findAll((node) => node.props.name === 'diegetic-home-control'),
    ).toHaveLength(0);
    await flat.unmount();
  });
});
