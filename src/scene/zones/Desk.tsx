/**
 * The Desk — About Me (REWORK_PLAN §3.2.2, commit 7; CRT-OS dock in 4b).
 *
 * Reuses the procedural monitor mesh + desktop-preview CanvasTexture built by
 * the room art pipeline (createMonitor / planMonitorDesktop): no new geometry,
 * material or texture is created here, so Room's existing teardown still owns
 * every GPU resource (B4). Pointer picking follows the Library's pattern —
 * the wrapper is aria-hidden and the whole layer is pointer-events:none until
 * `.scene-layer--interactive` (ready + fine pointer) opts the canvas back in;
 * keyboard/screen-reader visitors use the DOM About desktop instead.
 *
 * Commit 4b: five dock hit planes MIRROR the canonical plaque routes and are
 * only interactive/legible in the MONITOR_VIEWPOINT close-up. While the CRT
 * owns that close-up the plaque yields its highlight (one canonical surface),
 * and a coarse pointer sees decoration only.
 */
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { navigate } from '../../lib/router';
import { useDeferredDispose } from '../../lib/deferred-dispose';
import { DESIGN_TOKENS } from '../../styles/design-tokens';
import { usePortfolioStore } from '../../state/store';
import { CRT_DOCK, DIEGETIC_ROWS } from '../diegetic';
import { MONITOR_VIEWPOINT } from '../viewpoints';
import type { RoomPart } from '../art/geometry';
import type { RoomMaterials } from '../art/materials';

export interface DeskZoneProps {
  /** The monitor RoomParts from createMonitor(), placed at desk-top height. */
  monitor: readonly RoomPart[];
  materials: RoomMaterials;
}

/** Monitor-local x from a texture-space dock label x. */
export function crtDockX(textureX: number): number {
  return (textureX / CRT_DOCK.textureWidth) * 0.9 - 0.45;
}

export function DeskZone({ monitor, materials }: DeskZoneProps) {
  const openDesktop = usePortfolioStore((state) => state.openDesktop);
  const pointerFine = usePortfolioStore((state) => state.pointerFine);
  const menuHoverRoute = usePortfolioStore((state) => state.menuHoverRoute);
  const menuFocusRoute = usePortfolioStore((state) => state.menuFocusRoute);
  const setMenuHoverRoute = usePortfolioStore(
    (state) => state.setMenuHoverRoute,
  );
  const setCrtCloseUp = usePortfolioStore((state) => state.setCrtCloseUp);
  const camera = useThree((state) => state.camera);
  const [closeUp, setCloseUp] = useState(false);

  // No per-frame allocations: one preallocated target vector and a boolean
  // state flip only when the camera crosses the close-up threshold.
  const closeUpTarget = useMemo(
    () => new THREE.Vector3(...MONITOR_VIEWPOINT.position),
    [],
  );
  useFrame(() => {
    const near =
      camera.position.distanceToSquared(closeUpTarget) <
      CRT_DOCK.closeUpDistance * CRT_DOCK.closeUpDistance;
    if (near !== closeUp) {
      setCloseUp(near);
      setCrtCloseUp(near);
    }
  });

  useEffect(
    () => () => {
      document.body.style.cursor = '';
      setCrtCloseUp(false);
    },
    [setCrtCloseUp],
  );

  const hitGeometry = useMemo(
    () => new THREE.PlaneGeometry(CRT_DOCK.hitWidth, CRT_DOCK.hitHeight),
    [],
  );
  const highlightGeometry = useMemo(
    () =>
      new THREE.PlaneGeometry(
        CRT_DOCK.hitWidth + 0.02,
        CRT_DOCK.hitHeight + 0.014,
      ),
    [],
  );
  const highlightMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: DESIGN_TOKENS.state.focus,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    [],
  );
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

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    // Content stays in DOM: this only flips the store flag.
    openDesktop();
  };
  const onPointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    document.body.style.cursor = 'pointer';
  };
  const onPointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    document.body.style.cursor = '';
  };
  const dockPick = (route: string) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    navigate(route as (typeof DIEGETIC_ROWS)[number]['route']);
    setMenuHoverRoute(null);
  };
  const dockHover =
    (route: (typeof DIEGETIC_ROWS)[number]['route']) =>
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      setMenuHoverRoute(route);
      document.body.style.cursor = 'pointer';
    };

  const highlighted = closeUp ? (menuFocusRoute ?? menuHoverRoute) : null;

  return (
    <group
      name="desk-monitor"
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {monitor.map((part) => (
        <mesh
          key={part.id}
          geometry={part.geometry}
          material={materials[part.material]}
          position={part.position}
          rotation={part.rotation}
          scale={part.scale}
        />
      ))}
      {/* CRT-OS dock: transparent pick planes + ONE canonical highlight.
          Fine pointers only; the DOM menu remains the accessible path. */}
      {pointerFine &&
        closeUp &&
        DIEGETIC_ROWS.map((row, index) => (
          <mesh
            key={`crt-hit-${row.route}`}
            name={`crt-hit-${row.route}`}
            geometry={hitGeometry}
            material={hitMaterial}
            position={[
              crtDockX(CRT_DOCK.hitXs[index] ?? 130 + index * 60),
              CRT_DOCK.hitY,
              CRT_DOCK.hitZ,
            ]}
            onClick={dockPick(row.route)}
            onPointerOver={dockHover(row.route)}
            onPointerOut={onPointerOut}
          />
        ))}
      {closeUp &&
        DIEGETIC_ROWS.map((row, index) =>
          highlighted === row.route ? (
            <mesh
              key={`crt-highlight-${row.route}`}
              name={`crt-highlight-${row.route}`}
              geometry={highlightGeometry}
              material={highlightMaterial}
              position={[
                crtDockX(CRT_DOCK.hitXs[index] ?? 130 + index * 60),
                CRT_DOCK.hitY,
                CRT_DOCK.hitZ - 0.001,
              ]}
            />
          ) : null,
        )}
    </group>
  );
}
