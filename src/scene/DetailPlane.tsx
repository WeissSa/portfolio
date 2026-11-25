/**
 * Animated in-world detail plane (plan polish(c)).
 *
 * One textured Three plane carrying a detail page/card. `turn` pivots around
 * its left edge for the book's page-flip; `lift` rises/scales into view for a
 * case card, a CRT repaint or a projected INFO card. Both use a single damped
 * scalar in useFrame with NO per-frame allocations, and invalidate the demand
 * loop only while moving. Every GPU resource is deferred-disposed (StrictMode
 * safe — the same generation is re-used after a simulated unmount).
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useDeferredDispose } from '../lib/deferred-dispose';
import { DESIGN_TOKENS } from '../styles/design-tokens';
import { usePortfolioStore } from '../state/store';
import {
  paintDetailTexture,
  type DetailCanvasFactory,
  type DetailSpec,
} from './detail-texture';

const DAMP_LAMBDA = 8;
const SETTLE_EPSILON = 0.002;

export interface DetailPlaneProps {
  spec: DetailSpec;
  position: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  width?: number;
  height?: number;
  active: boolean;
  /** `turn` flips around the left edge (book); `lift` rises + scales into view. */
  motion?: 'turn' | 'lift';
  name?: string;
  canvasFactory?: DetailCanvasFactory;
}

export function DetailPlane({
  spec,
  position,
  rotation,
  width = 0.7,
  height = 0.52,
  active,
  motion = 'lift',
  name = 'detail-plane',
  canvasFactory,
}: DetailPlaneProps) {
  const invalidate = useThree((state) => state.invalidate);
  const focused = usePortfolioStore((state) => state.detailMirrorFocused);
  const pivot = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const progress = useRef(0);

  // The key drives generation: a different post/year repaints and disposes the
  // old texture once, while hover/selection changes do not churn the canvas.
  const texture = useMemo(
    () => paintDetailTexture(spec, canvasFactory),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec.key, canvasFactory],
  );
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(width, height),
    [width, height],
  );
  const material = useMemo(
    () =>
      texture
        ? new THREE.MeshBasicMaterial({
            map: texture,
            toneMapped: false,
            // A turned page is front-face only: past 90° its back is culled, so
            // the reader never sees mirrored lettering; the revealed page below
            // is the readable one. Static cards stay double-sided.
            side: motion === 'turn' ? THREE.FrontSide : THREE.DoubleSide,
          })
        : null,
    [texture, motion],
  );
  const focusMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: DESIGN_TOKENS.state.focus,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    [],
  );

  useDeferredDispose(() => texture?.dispose(), [texture]);
  useDeferredDispose(() => geometry.dispose(), [geometry]);
  useDeferredDispose(() => {
    material?.dispose();
    focusMaterial.dispose();
  }, [material, focusMaterial]);

  useEffect(() => invalidate(), [active, focused, invalidate]);

  // A detail plane is readout, not a pick target: swallow pointer hits so a
  // click on the open book/case/CRT/projector card never falls through to the
  // pickable geometry behind it (all four surfaces share this component).
  const swallowPointer = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
  };
  const swallowClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
  };

  useFrame((_state, delta) => {
    const target = active ? 1 : 0;
    const next = THREE.MathUtils.damp(
      progress.current,
      target,
      DAMP_LAMBDA,
      Math.min(delta, 0.1),
    );
    progress.current = next;
    const moving = Math.abs(next - target) > SETTLE_EPSILON;
    if (pivot.current) {
      pivot.current.rotation.y = motion === 'turn' ? -next * Math.PI : 0;
    }
    if (mesh.current && motion !== 'turn') {
      mesh.current.position.y = -(1 - next) * 0.18;
      mesh.current.scale.setScalar(0.6 + 0.4 * next);
    }
    if (moving) invalidate();
  });

  if (!material) return null;
  return (
    <group
      name={name}
      position={[...position]}
      rotation={rotation ? [...rotation] : undefined}
    >
      <group ref={pivot} name={`${name}-pivot`}>
        <mesh
          ref={mesh}
          geometry={geometry}
          material={material}
          position={motion === 'turn' ? [width / 2, 0, 0] : [0, 0, 0]}
          onPointerDown={swallowPointer}
          onClick={swallowClick}
        />
      </group>
      {focused && (
        <mesh
          name={`${name}-focus`}
          geometry={geometry}
          material={focusMaterial}
          scale={[1.06, 1.06, 1]}
          position={[motion === 'turn' ? width / 2 : 0, 0, -0.004]}
          onPointerDown={swallowPointer}
          onClick={swallowClick}
        />
      )}
    </group>
  );
}
