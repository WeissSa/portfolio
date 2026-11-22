/**
 * The Desk — About Me (REWORK_PLAN §3.2.2, commit 7).
 *
 * Reuses the procedural monitor mesh + desktop-preview CanvasTexture built by
 * the room art pipeline (createMonitor / planMonitorDesktop): no new geometry,
 * material or texture is created here, so Room's existing teardown still owns
 * every GPU resource (B4). Pointer picking follows the Library's pattern —
 * the wrapper is aria-hidden and the whole layer is pointer-events:none until
 * `.scene-layer--interactive` (ready + fine pointer) opts the canvas back in;
 * keyboard/screen-reader visitors use the DOM About desktop instead.
 *
 * Headless render tests verify structure + click wiring only; pixel-level
 * appearance still needs a real browser (§6 screenshot review).
 */
import { useEffect } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { usePortfolioStore } from '../../state/store';
import type { RoomPart } from '../art/geometry';
import type { RoomMaterials } from '../art/materials';

export interface DeskZoneProps {
  /** The monitor RoomParts from createMonitor(), placed at desk-top height. */
  monitor: readonly RoomPart[];
  materials: RoomMaterials;
}

export function DeskZone({ monitor, materials }: DeskZoneProps) {
  const openDesktop = usePortfolioStore((state) => state.openDesktop);

  useEffect(() => () => void (document.body.style.cursor = ''), []);

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    // Content stays in DOM: this only flips the store flag. App renders the
    // SAME AboutDesktop component used by the 2D hash route, full-screen.
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
    </group>
  );
}
