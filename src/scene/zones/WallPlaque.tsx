/**
 * CANONICAL diegetic global nav — the brass/wood wall plaque (commit 4).
 *
 * Five pickable rows map 1:1 to the same hash routes as the sr-only DOM menu.
 * Hover writes `menuHoverRoute` (→ DOM twin highlight); DOM keyboard focus
 * writes `menuFocusRoute` (→ in-world highlight). Only ONE surface is lit at a
 * time: the plaque yields to the CRT mirror while the monitor close-up is open
 * (4b). Coarse pointers never get interactive-looking hover/pulse affordances;
 * the fully opaque DOM menu is authoritative there.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useDeferredDispose } from '../../lib/deferred-dispose';
import { navigate, type Route } from '../../lib/router';
import { DESIGN_TOKENS } from '../../styles/design-tokens';
import { usePortfolioStore } from '../../state/store';
import { DIEGETIC_ROWS, PLAQUE } from '../diegetic';
import type { RoomPart } from '../art/geometry';
import type { RoomMaterials } from '../art/materials';

export interface WallPlaqueProps {
  parts: readonly RoomPart[];
  materials: RoomMaterials;
}

/** Texture-space baseline → plaque-local world y (texture y grows downward). */
export function plaqueRowY(index: number): number {
  const baseline = PLAQUE.rowBaselines[index] ?? 38 + index * 62;
  const glyphCentre = baseline - PLAQUE.fontPx * 0.36;
  return (
    PLAQUE.height / 2 - (glyphCentre / PLAQUE.textureHeight) * PLAQUE.height
  );
}

export function WallPlaque({ parts, materials }: WallPlaqueProps) {
  const pointerFine = usePortfolioStore((state) => state.pointerFine);
  const menuHoverRoute = usePortfolioStore((state) => state.menuHoverRoute);
  const menuFocusRoute = usePortfolioStore((state) => state.menuFocusRoute);
  const setMenuHoverRoute = usePortfolioStore(
    (state) => state.setMenuHoverRoute,
  );
  const desktopOpen = usePortfolioStore((state) => state.desktopOpen);
  const invalidate = useThree((state) => state.invalidate);

  const hitGeometry = useMemo(
    () => new THREE.PlaneGeometry(PLAQUE.width - 0.3, PLAQUE.height / 5 - 0.02),
    [],
  );
  const highlightGeometry = useMemo(
    () =>
      new THREE.PlaneGeometry(PLAQUE.width - 0.22, PLAQUE.height / 5 - 0.008),
    [],
  );
  const highlightMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        // Canonical focus token (gold); gilt text stays on the dark inlay.
        color: DESIGN_TOKENS.state.focus,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    [],
  );
  // Transparent (not `visible={false}`) so R3F still raycasts the row planes.
  const hitMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );
  useDeferredDispose(() => {
    hitGeometry.dispose();
    highlightGeometry.dispose();
    highlightMaterial.dispose();
    hitMaterial.dispose();
  }, [hitGeometry, highlightGeometry, highlightMaterial, hitMaterial]);
  useEffect(() => () => void (document.body.style.cursor = ''), []);

  // Highlight precedence: DOM keyboard focus > pointer hover. The plaque is
  // NOT lit while the monitor close-up owns the canonical highlight (4b).
  const highlighted = desktopOpen ? null : (menuFocusRoute ?? menuHoverRoute);
  useEffect(() => invalidate(), [highlighted, invalidate]);

  const pick = (route: Route) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    navigate(route);
    setMenuHoverRoute(null);
  };
  const hover = (route: Route) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setMenuHoverRoute(route);
    document.body.style.cursor = 'pointer';
    invalidate();
  };
  const out = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setMenuHoverRoute(null);
    document.body.style.cursor = '';
    invalidate();
  };

  return (
    <group name="wall-plaque-parts">
      {parts.map((part) => (
        <mesh
          key={part.id}
          geometry={part.geometry}
          material={materials[part.material]}
          position={part.position}
          rotation={part.rotation}
          scale={part.scale}
        />
      ))}
      {/* Five invisible pick planes; present only for fine pointers so touch
          devices see decoration, not a fake interactive control. */}
      {pointerFine &&
        DIEGETIC_ROWS.map((row, index) => (
          <mesh
            key={`hit-${row.route}`}
            name={`plaque-hit-${row.route}`}
            geometry={hitGeometry}
            material={hitMaterial}
            position={[0, plaqueRowY(index), 0.024]}
            onClick={pick(row.route)}
            onPointerOver={hover(row.route)}
            onPointerOut={out}
          />
        ))}
      {/* Gold wash behind ONE canonical row. No emissive pulse when picking is
          unavailable — coarse pointers only ever see the static lettering. */}
      {DIEGETIC_ROWS.map((row, index) =>
        highlighted === row.route ? (
          <mesh
            key={`highlight-${row.route}`}
            name={`plaque-highlight-${row.route}`}
            geometry={highlightGeometry}
            material={highlightMaterial}
            position={[0, plaqueRowY(index), 0.016]}
          />
        ) : null,
      )}
    </group>
  );
}
