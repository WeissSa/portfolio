/**
 * Always-visible in-world HOME control (owner round-3 review). The wall plaque
 * is only in the establishing shot, so once the camera flies into a zone a
 * pointer user had no diegetic way back without Tab. This small brass plaque is
 * parented to the camera (camera-space, never a floating DOM overlay), clicks
 * navigate to '/', and the accessible DOM menu remains the keyboard/SR path.
 *
 * No new lights, no animation, no per-frame allocations: useFrame only copies
 * the camera pose into one group; the demand loop already invalidates during
 * every camera flight.
 */
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useDeferredDispose } from '../lib/deferred-dispose';
import { navigate } from '../lib/router';
import { DESIGN_TOKENS } from '../styles/design-tokens';
import { usePortfolioStore } from '../state/store';
import { HOME_FOV_DEGREES, homeControlVisible } from './diegetic';
import { PALETTE } from './art/palette';

/** Plate size + camera-space depth used by the frustum fit below. */
export const HOME_BADGE_SIZE = { width: 0.32, height: 0.12 } as const;
const BADGE_X = -0.62;
const BADGE_Y = -0.36;
const BADGE_Z = -1.1;
/** Air gap (world units) between the plate edge and the frustum edge. */
const EDGE_MARGIN = 0.03;

/**
 * Aspect-aware camera-space placement. At narrow viewports (QA 900px, aspect
 * 0.75–1.125) the old fixed x pushed the ◀ HOME glyphs OUT of the frustum, so
 * pull the plate inward until its left edge clears the frustum half-extent.
 * Wide viewports keep the original bottom-left placement.
 */
export function homeControlPlacement(aspect: number): [number, number, number] {
  const halfWidth =
    Math.abs(BADGE_Z) * Math.tan((HOME_FOV_DEGREES * Math.PI) / 360) * aspect;
  const minX = EDGE_MARGIN + HOME_BADGE_SIZE.width / 2 - halfWidth;
  return [Math.max(BADGE_X, minX), BADGE_Y, BADGE_Z];
}

export function HomeControl() {
  const mode = usePortfolioStore((state) => state.mode);
  const activeZone = usePortfolioStore((state) => state.activeZone);
  const pointerFine = usePortfolioStore((state) => state.pointerFine);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const placement = useMemo(
    () => homeControlPlacement(size.width / size.height),
    [size.width, size.height],
  );
  const [hovered, setHovered] = useState(false);
  const group = useRef<THREE.Group>(null);
  const visible = homeControlVisible(mode, activeZone, pointerFine);

  const geometry = useMemo(
    () =>
      new THREE.PlaneGeometry(HOME_BADGE_SIZE.width, HOME_BADGE_SIZE.height),
    [],
  );
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = PALETTE.brassDark;
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = PALETTE.brassLight;
    ctx.lineWidth = 4;
    ctx.strokeRect(5, 5, 246, 86);
    ctx.fillStyle = DESIGN_TOKENS.climate.projectorPlaqueText;
    ctx.font = 'bold 40px Anton, Arial Narrow, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('◀ HOME', 128, 50);
    const built = new THREE.CanvasTexture(canvas);
    built.colorSpace = THREE.SRGBColorSpace;
    return built;
  }, []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        ...(texture ? { map: texture } : {}),
        transparent: true,
        toneMapped: false,
        color: hovered ? DESIGN_TOKENS.state.focus : DESIGN_TOKENS.p5.white,
      }),
    [texture, hovered],
  );
  // A hover flip replaces ONLY the colour material. The plate geometry and
  // canvas texture are stable, so they must stay GPU-resident until the badge
  // truly unmounts — disposing them on hover frees buffers still in use.
  useDeferredDispose(() => {
    material.dispose();
  }, [material]);
  useDeferredDispose(() => {
    geometry.dispose();
    texture?.dispose();
  }, [geometry, texture]);

  useFrame(() => {
    if (!group.current) return;
    group.current.position.copy(camera.position);
    group.current.quaternion.copy(camera.quaternion);
  });

  // In headless/jsdom (no 2D canvas) the brass plate still renders untextured.
  if (!visible) return null;

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    document.body.style.cursor = '';
    navigate('/');
  };
  const onOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
    invalidate();
  };
  const onOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(false);
    document.body.style.cursor = '';
    invalidate();
  };

  return (
    <group ref={group}>
      <mesh
        name="diegetic-home-control"
        geometry={geometry}
        material={material}
        position={placement}
        onClick={onClick}
        onPointerOver={onOver}
        onPointerOut={onOut}
      />
    </group>
  );
}
