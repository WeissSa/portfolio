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
import { PickableEdges, pickAffordance, useZoneSpotlight } from '../affordance';
import { navigateAndCloseDetail } from '../../lib/navigation';
import { useDeferredDispose } from '../../lib/deferred-dispose';
import { focusDetailTrigger } from '../../lib/detail-mode';
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
  const [monitorHovered, setMonitorHovered] = useState(false);
  // About-zone spotlight: the monitor + dock pickables gain a gold edge after
  // the camera settles; picking the monitor still opens the DOM desktop.
  const spotlight = useZoneSpotlight('/about');

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
    // In-world CRT content is painted below; this flips the store flag and
    // focuses the F2 trigger proxy (no-op when the DOM proxy is absent).
    focusDetailTrigger();
    openDesktop();
  };
  const onPointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setMonitorHovered(true);
    document.body.style.cursor = 'pointer';
  };
  const onPointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setMonitorHovered(false);
    document.body.style.cursor = '';
  };
  const dockPick = (route: string) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    navigateAndCloseDetail(route as (typeof DIEGETIC_ROWS)[number]['route']);
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
  const bezel = monitor.find((part) => part.id === 'monitor-bezel');

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
      {bezel && (
        <PickableEdges
          geometry={bezel.geometry}
          position={bezel.position ?? [0, 0, 0]}
          rotation={bezel.rotation ?? [0, 0, 0]}
          scale={bezel.scale ?? [1, 1, 1]}
          state={pickAffordance(monitorHovered, false, spotlight)}
          name="monitor-affordance"
        />
      )}
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
        DIEGETIC_ROWS.map((row, index) => {
          const position: [number, number, number] = [
            crtDockX(CRT_DOCK.hitXs[index] ?? 130 + index * 60),
            CRT_DOCK.hitY,
            CRT_DOCK.hitZ - 0.001,
          ];
          return (
            <group key={`crt-row-${row.route}`}>
              {highlighted === row.route && (
                <mesh
                  name={`crt-highlight-${row.route}`}
                  geometry={highlightGeometry}
                  material={highlightMaterial}
                  position={position}
                />
              )}
              <PickableEdges
                geometry={highlightGeometry}
                position={position}
                state={pickAffordance(
                  highlighted === row.route,
                  menuFocusRoute === row.route,
                  // No blanket five-row outline in the close-up: the monitor
                  // itself carries the About-zone spotlight, and this keeps
                  // the draw-call budget intact while the dialog is open.
                  false,
                )}
                name={`crt-affordance-${row.route}`}
              />
            </group>
          );
        })}
    </group>
  );
}
