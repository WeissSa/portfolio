/**
 * Reusable in-world click affordance + zone spotlight (owner review 2026-11-24).
 * Every diegetic pick target uses the same four-state treatment; the R3F tests
 * below check the applied state on the plaque and on books, while the store
 * test pins that spotlights wait for the camera to settle.
 */
import { renderHook } from '@testing-library/react';
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { POSTS, postId } from '../src/content/posts';
import { usePortfolioStore } from '../src/state/store';
import {
  affordanceOpacity,
  affordanceTint,
  PickableEdges,
  pickAffordance,
  useZoneSpotlight,
} from '../src/scene/affordance';
import { createWallPlaque, createBookshelf } from '../src/scene/art/geometry';
import {
  createRoomMaterials,
  disposeRoomMaterials,
  type RoomMaterials,
} from '../src/scene/art/materials';
import { LibraryZone } from '../src/scene/zones/Library';
import { WallPlaque } from '../src/scene/zones/WallPlaque';

beforeEach(() => {
  usePortfolioStore.setState({
    activeDetail: null,
    mode: '2d',
    activeZone: '/',
    cameraSettled: true,
    pointerFine: true,
    menuHoverRoute: null,
    menuFocusRoute: null,
    crtCloseUp: false,
    hoveredPostId: null,
  });
  document.body.style.cursor = '';
});

async function flushTimers(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

describe('affordance primitives', () => {
  it('ramps neutral → gold for zone / hover / selected', () => {
    const base = '#445566';
    const idle = affordanceTint(base, 'idle');
    expect(idle.getHexString()).toBe('445566');
    for (const state of ['zone', 'hover', 'selected'] as const) {
      const tinted = affordanceTint(base, state);
      expect(tinted.getHexString()).not.toBe(idle.getHexString());
      expect(affordanceOpacity(state)).toBeGreaterThan(0);
    }
    expect(affordanceOpacity('idle')).toBe(0); // idle draws no outline at all
    expect(pickAffordance(false, false, false)).toBe('idle');
    expect(pickAffordance(false, false, true)).toBe('zone');
    expect(pickAffordance(true, false, true)).toBe('hover');
    expect(pickAffordance(true, true, false)).toBe('selected');
  });

  it('turns a zone spotlight on only after the camera settles in live 3D', () => {
    const { result } = renderHook(() => useZoneSpotlight('/projects'));
    expect(result.current).toBe(false); // 2D

    act(() => usePortfolioStore.setState({ mode: '3d', activeZone: '/' }));
    expect(result.current).toBe(false); // wrong zone

    act(() =>
      usePortfolioStore.setState({ mode: '3d', activeZone: '/projects' }),
    );
    expect(result.current).toBe(true);

    act(() => usePortfolioStore.setState({ cameraSettled: false }));
    expect(result.current).toBe(false); // still flying — no premature spotlight

    act(() => usePortfolioStore.setState({ cameraSettled: true }));
    expect(result.current).toBe(true);

    act(() => usePortfolioStore.setState({ activeZone: '/' }));
    expect(result.current).toBe(false); // leaving the zone turns it off
  });
});

describe('diegetic pick affordance in the R3F scene', () => {
  let materials: RoomMaterials;

  beforeEach(() => {
    materials = createRoomMaterials();
  });

  it('shows gold edges on wall plaque rows for hover, focus and zone spotlight', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <WallPlaque
        parts={createWallPlaque('affordance-test')}
        materials={materials}
      />,
      { frameloop: 'never' },
    );
    const outlines = () =>
      renderer.scene.findAll((node) =>
        Boolean(
          (node.instance as THREE.Object3D | undefined)?.name?.startsWith(
            'plaque-affordance-',
          ),
        ),
      );
    const opacity = (index: number) =>
      (
        (outlines()[index]!.instance as THREE.LineSegments)
          .material as THREE.LineBasicMaterial
      ).opacity;

    expect(outlines()).toHaveLength(0);

    act(() => usePortfolioStore.getState().setMenuHoverRoute('/about'));
    expect(outlines()).toHaveLength(1);
    expect(opacity(0)).toBeCloseTo(0.85);

    act(() => usePortfolioStore.getState().setMenuFocusRoute('/projects'));
    expect(outlines()).toHaveLength(1);
    expect(opacity(0)).toBe(1); // keyboard focus = selected = full gold

    act(() => {
      usePortfolioStore.setState({
        mode: '3d',
        menuHoverRoute: null,
        menuFocusRoute: null,
      });
    });
    expect(outlines()).toHaveLength(5); // home spotlight lights every row
    expect(opacity(0)).toBeCloseTo(0.45);

    act(() => usePortfolioStore.setState({ cameraSettled: false }));
    expect(outlines()).toHaveLength(0); // flight in progress → off

    await renderer.unmount();
    disposeRoomMaterials(materials);
  });

  it('shows one book outline on hover/selection with the stronger gold', async () => {
    const cells = createBookshelf('affordance-test').cells;
    const renderer = await ReactThreeTestRenderer.create(
      <LibraryZone cells={cells} materials={materials} />,
      { frameloop: 'never' },
    );
    const outlines = () =>
      renderer.scene.findAll(
        (node) =>
          (node.instance as THREE.Object3D | undefined)?.name ===
          'book-affordance',
      );
    const outlineOpacity = () =>
      (
        (outlines()[0]!.instance as THREE.LineSegments)
          .material as THREE.LineBasicMaterial
      ).opacity;

    expect(outlines()).toHaveLength(0);
    const id = postId(POSTS[2]!);
    act(() => usePortfolioStore.getState().setHoveredPost(id));
    expect(outlines()).toHaveLength(1);
    expect(outlineOpacity()).toBeCloseTo(0.85);

    act(() => {
      usePortfolioStore.getState().setHoveredPost(null);
      usePortfolioStore.getState().openDetail({ kind: 'post', id: id });
    });
    expect(outlines()).toHaveLength(1);
    expect(outlineOpacity()).toBe(1);

    await renderer.unmount();
    disposeRoomMaterials(materials);
  });

  it('keeps the shared edge geometry alive across hover/selection changes', async () => {
    const source = new THREE.PlaneGeometry(1, 0.6);
    const renderer = await ReactThreeTestRenderer.create(
      <PickableEdges
        geometry={source}
        position={[0, 0, 0]}
        state="zone"
        name="edges-disposal-test"
      />,
      { frameloop: 'never' },
    );
    const lineOf = () =>
      renderer.scene.find((node) => node.props.name === 'edges-disposal-test')!
        .instance as THREE.LineSegments;
    const edges = lineOf().geometry as THREE.EdgesGeometry;
    const material = lineOf().material as THREE.LineDashedMaterial;
    const disposeEdges = vi.spyOn(edges, 'dispose');

    for (const state of ['hover', 'selected', 'zone'] as const) {
      await renderer.update(
        <PickableEdges
          geometry={source}
          position={[0, 0, 0]}
          state={state}
          name="edges-disposal-test"
        />,
      );
      await flushTimers();
      expect(lineOf().geometry).toBe(edges); // same GPU buffer reused
      expect(lineOf().material).not.toBe(material); // only the material changed
      expect(disposeEdges).not.toHaveBeenCalled();
    }

    await renderer.unmount();
    await flushTimers();
    expect(disposeEdges).toHaveBeenCalledTimes(1); // true unmount frees it
    source.dispose();
  });
});
