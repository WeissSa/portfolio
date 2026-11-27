/**
 * Round-3 review: a diegetic HOME control must be reachable from every zone
 * without Tab. It lives inside the R3F canvas (camera-parented), never as a
 * floating DOM overlay, and keeps the DOM menu as the a11y/keyboard path.
 *
 * Review sweep additions: the badge is centred in the visible left band, fits
 * narrow viewports, and a hover flip must free ONLY the colour material (not
 * the stable geometry/texture the remounted scene still draws).
 */
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePortfolioStore } from '../src/state/store';
import {
  HOME_BADGE_SIZE,
  HomeControl,
  homeControlPlacement,
} from '../src/scene/HomeControl';
import { HOME_FOV_DEGREES } from '../src/scene/diegetic';
import { DESIGN_TOKENS } from '../src/styles/design-tokens';

beforeEach(() => {
  window.location.hash = '';
  usePortfolioStore.setState({
    mode: '3d',
    activeZone: '/',
    pointerFine: true,
  });
  document.body.style.cursor = '';
});

async function flushTimers(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

/** True when all four plate corners project inside the camera frustum. */
function badgeWithinFrustum(
  position: readonly [number, number, number],
  aspect: number,
): boolean {
  const camera = new THREE.PerspectiveCamera(HOME_FOV_DEGREES, aspect, 0.1, 60);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const [x, y, z] = position;
  return [-1, 1].every((sx) =>
    [-1, 1].every((sy) => {
      const ndc = new THREE.Vector3(
        x + sx * (HOME_BADGE_SIZE.width / 2),
        y + sy * (HOME_BADGE_SIZE.height / 2),
        z,
      ).project(camera);
      return (
        Math.abs(ndc.x) <= 1 &&
        Math.abs(ndc.y) <= 1 &&
        ndc.z >= -1 &&
        ndc.z <= 1
      );
    }),
  );
}

/** Minimal 2D context: jsdom has no canvas backend but the badge only paints text. */
function fake2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const noop = () => {};
  const gradient = { addColorStop: noop };
  return {
    canvas,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    lineCap: 'butt',
    fillRect: noop,
    strokeRect: noop,
    fillText: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    createRadialGradient: () => gradient,
  } as unknown as CanvasRenderingContext2D;
}

describe('in-world HOME control', () => {
  it('renders in a zone, navigates home on pick and hides at home', async () => {
    act(() => usePortfolioStore.setState({ activeZone: '/experience' }));
    const renderer = await ReactThreeTestRenderer.create(<HomeControl />, {
      frameloop: 'never',
      width: 1440,
      height: 900,
    });
    const controls = () =>
      renderer.scene.findAll(
        (node) =>
          node.props.name === 'diegetic-home-control' ||
          (node.instance as THREE.Object3D | undefined)?.name ===
            'diegetic-home-control',
      );
    expect(controls()).toHaveLength(1);
    // Centred in the reserved left band (viewport 25% ⇒ NDC -0.5), not at the
    // viewport centre where the 3D DOM column would cover the plate.
    const [x, y, z] = controls()[0]!.props.position as [number, number, number];
    expect(x).toBeCloseTo(
      -0.5 * 1.1 * Math.tan((HOME_FOV_DEGREES * Math.PI) / 360) * (1440 / 900),
      6,
    );
    expect([y, z]).toEqual([-0.36, -1.1]);

    // HOME must win even while an in-world detail owns the camera: opening a
    // detail closes the others by design, so set the live one and pick HOME.
    act(() => {
      usePortfolioStore.getState().selectPost('detail-post');
      window.location.hash = '#/experience';
    });
    expect(usePortfolioStore.getState().selectedPostId).toBe('detail-post');
    expect(window.location.hash).toBe('#/experience');

    const stopPropagation = vi.fn();
    act(() => controls()[0]!.props.onClick({ stopPropagation }));
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#/');
    const afterHome = usePortfolioStore.getState();
    expect(afterHome.selectedPostId).toBeNull();
    expect(afterHome.selectedProjectId).toBeNull();
    expect(afterHome.climatePanelOpen).toBe(false);
    expect(afterHome.desktopOpen).toBe(false);

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

  it('centres the badge in the visible left band and keeps every corner in frustum', async () => {
    act(() => usePortfolioStore.setState({ activeZone: '/experience' }));
    // Owner 2026-11-26: the badge must sit in the CLEAR band, not beneath the
    // 3D DOM column that occupies the right half of the viewport.
    const renderer = await ReactThreeTestRenderer.create(<HomeControl />, {
      frameloop: 'never',
      width: 768,
      height: 1024,
    });
    const controls = renderer.scene.findAll(
      (node) => node.props.name === 'diegetic-home-control',
    );
    expect(controls).toHaveLength(1);
    const position = controls[0]!.props.position as [number, number, number];
    expect(badgeWithinFrustum(position, 768 / 1024)).toBe(true);
    expect(position[0]).toBeLessThan(0); // left-of-centre = visible band
    await renderer.unmount();

    // Practical QA aspects + wide desktop. 0.75 sits on the clamp boundary
    // (~0.74), where the ideal NDC -0.5 centre becomes assertion-brittle; the
    // extreme narrow case is checked explicitly below instead.
    for (const aspect of [0.8, 0.9, 1.125, 1.6]) {
      const placement = homeControlPlacement(aspect);
      const halfWidth =
        1.1 * Math.tan((HOME_FOV_DEGREES * Math.PI) / 360) * aspect;
      expect(badgeWithinFrustum(placement, aspect)).toBe(true);
      // NDC -0.5 ⇒ the centre of the reserved left half at these aspects.
      expect(placement[0]).toBeCloseTo(-0.5 * halfWidth, 6);
      expect(placement[1]).toBe(-0.36);
    }
    // Below the clamp threshold the guard pulls the plate inward, still fully
    // on screen — it must not be asserted against the unclamped NDC centre.
    const narrow = homeControlPlacement(0.5);
    const narrowHalfWidth =
      1.1 * Math.tan((HOME_FOV_DEGREES * Math.PI) / 360) * 0.5;
    expect(badgeWithinFrustum(narrow, 0.5)).toBe(true);
    expect(narrow[0]).toBeGreaterThan(-0.5 * narrowHalfWidth);
  });

  it('disposes only the material on hover; geometry/texture on true unmount', async () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(function (this: HTMLCanvasElement) {
        return fake2dContext(this) as unknown as CanvasRenderingContext2D;
      });
    try {
      act(() => usePortfolioStore.setState({ activeZone: '/experience' }));
      const renderer = await ReactThreeTestRenderer.create(<HomeControl />, {
        frameloop: 'never',
      });
      const control = () =>
        renderer.scene.findAll(
          (node) => node.props.name === 'diegetic-home-control',
        )[0]!;
      const initialMesh = control().instance as THREE.Mesh;
      const geometry = initialMesh.geometry as THREE.BufferGeometry;
      const material = initialMesh.material as THREE.MeshBasicMaterial;
      const texture = material.map as THREE.CanvasTexture;
      expect(texture).toBeTruthy();
      const disposeGeometry = vi.spyOn(geometry, 'dispose');
      const disposeTexture = vi.spyOn(texture, 'dispose');

      await act(async () => {
        control().props.onPointerOver({ stopPropagation: vi.fn() });
      });
      await flushTimers();
      const hoveredMesh = control().instance as THREE.Mesh;
      expect(hoveredMesh.material).not.toBe(material);
      expect((hoveredMesh.material as THREE.MeshBasicMaterial).map).toBe(
        texture,
      );
      expect(disposeGeometry).not.toHaveBeenCalled();
      expect(disposeTexture).not.toHaveBeenCalled();

      await act(async () => {
        control().props.onPointerOut({ stopPropagation: vi.fn() });
      });
      await flushTimers();
      expect(disposeGeometry).not.toHaveBeenCalled();
      expect(disposeTexture).not.toHaveBeenCalled();

      await renderer.unmount();
      await flushTimers();
      expect(disposeGeometry).toHaveBeenCalledTimes(1);
      expect(disposeTexture).toHaveBeenCalledTimes(1);
    } finally {
      getContext.mockRestore();
    }
  });

  it('clears a stuck hover on unmount / zone change / mode toggle', async () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(function (this: HTMLCanvasElement) {
        return fake2dContext(this) as unknown as CanvasRenderingContext2D;
      });
    try {
      act(() =>
        usePortfolioStore.setState({
          mode: '3d',
          activeZone: '/experience',
          pointerFine: true,
        }),
      );
      const renderer = await ReactThreeTestRenderer.create(<HomeControl />, {
        frameloop: 'never',
      });
      const control = () =>
        renderer.scene.findAll(
          (node) => node.props.name === 'diegetic-home-control',
        )[0]!;
      const tint = () =>
        (
          (control().instance as THREE.Mesh).material as THREE.MeshBasicMaterial
        ).color.getHexString();
      const gold = new THREE.Color(DESIGN_TOKENS.state.focus).getHexString();

      await act(async () => {
        control().props.onPointerOver({ stopPropagation: vi.fn() });
      });
      expect(document.body.style.cursor).toBe('pointer');
      expect(tint()).toBe(gold);

      // Zone change unmounts the badge; R3F fires no onPointerOut for a
      // stationary cursor, so the cleanup must reset both pieces of state.
      await act(async () => {
        usePortfolioStore.setState({ activeZone: '/' });
      });
      expect(
        renderer.scene.findAll(
          (node) => node.props.name === 'diegetic-home-control',
        ),
      ).toHaveLength(0);
      expect(document.body.style.cursor).toBe('');

      await act(async () => {
        usePortfolioStore.setState({ activeZone: '/experience' });
      });
      expect(tint()).not.toBe(gold); // re-entry is idle, not gold-tinted

      // Same cleanup on a mode toggle while hovered.
      await act(async () => {
        control().props.onPointerOver({ stopPropagation: vi.fn() });
      });
      expect(document.body.style.cursor).toBe('pointer');
      await act(async () => {
        usePortfolioStore.setState({ mode: '2d' });
      });
      expect(document.body.style.cursor).toBe('');
      await renderer.unmount();
    } finally {
      getContext.mockRestore();
      document.body.style.cursor = '';
    }
  });
});
