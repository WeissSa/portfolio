/**
 * Reusable in-world click affordance (owner review 2026-11-24).
 *
 * Every diegetic pick target uses the SAME four-state treatment so a sighted
 * pointer user can tell what is clickable without any DOM overlay:
 *
 *   idle    → natural material, no extra draw call
 *   zone    → subtle gold tint / outline once the camera has settled in-zone
 *   hover   → brighter gold tint + thin brass/gold EdgesGeometry outline
 *   selected→ full gold, stronger outline (the DOM mirror owns the content)
 *
 * `PickableEdges` renders NOTHING in the idle state, so the room's draw-call
 * budget is unchanged until something is actually highlighted. The zone state
 * comes from `activeZone` + CameraRig's `cameraSettled` flag; reduced-motion
 * reaches it via an instant cut, and no state uses animation, so there are no
 * pulses. No new lights are added (≤5 light contract preserved).
 */
import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { useDeferredDispose } from '../lib/deferred-dispose';
import type { Route } from '../lib/router';
import { DESIGN_TOKENS } from '../styles/design-tokens';
import { usePortfolioStore } from '../state/store';
import { PALETTE } from './art/palette';

export type PickAffordance = 'idle' | 'zone' | 'hover' | 'selected';

/** Neutral → gold lerp, shared by books/cases and any other tinted pickable. */
export function affordanceTint(
  base: THREE.ColorRepresentation,
  state: PickAffordance,
): THREE.Color {
  const color = new THREE.Color(base);
  const strength =
    state === 'selected'
      ? 0.55
      : state === 'hover'
        ? 0.4
        : state === 'zone'
          ? 0.3
          : 0;
  return strength === 0
    ? color
    : color.lerp(new THREE.Color(DESIGN_TOKENS.state.focus), strength);
}

/** Opacity of the in-world edge outline for each state (idle draws nothing). */
export function affordanceOpacity(state: PickAffordance): number {
  if (state === 'selected') return 1;
  if (state === 'hover') return 0.85;
  if (state === 'zone') return 0.45;
  return 0;
}

/** True only in live 3D, in this zone, after the camera flight has settled. */
export function useZoneSpotlight(zone: Route): boolean {
  return usePortfolioStore(
    (state) =>
      state.mode === '3d' && state.activeZone === zone && state.cameraSettled,
  );
}

export function pickAffordance(
  hovered: boolean,
  selected: boolean,
  spotlight: boolean,
): PickAffordance {
  if (selected) return 'selected';
  if (hovered) return 'hover';
  return spotlight ? 'zone' : 'idle';
}

export type Vec3Tuple = readonly [number, number, number];

export interface PickableEdgesProps {
  /** Geometry to derive the thin outline from (owned by the calling zone). */
  geometry: THREE.BufferGeometry;
  position: Vec3Tuple;
  rotation?: Vec3Tuple;
  scale?: Vec3Tuple;
  state: PickAffordance;
  name?: string;
}

/**
 * Hand-inlaid brass/gold edge outline, rendered ONLY for non-idle states. The
 * geometry and material are memoized and deferred-disposed, so StrictMode's
 * dev double-invoke cannot free a GPU buffer that the remounted scene still
 * draws. A state change frees only the replaced material — the outline
 * geometry stays bound to the new line until a true unmount.
 */
export function PickableEdges({
  geometry,
  position,
  rotation,
  scale,
  state,
  name,
}: PickableEdgesProps): ReactNode {
  // Hand-inlaid look: a deterministic 2% wobble on every edge vertex plus a
  // dashed brass stroke for the ambient zone state (gold only on active pick).
  // A raw EdgesGeometry rectangle read as a geometric/CAD outline (round-3
  // review), so neither the wobble nor the dash pattern depend on frame time.
  const edgeRig = useMemo(() => {
    const edges = new THREE.EdgesGeometry(geometry, 25);
    edges.computeBoundingSphere();
    const radius = edges.boundingSphere?.radius ?? 1;
    const position = edges.getAttribute('position') as THREE.BufferAttribute;
    const wobble = radius * 0.02;
    for (let index = 0; index < position.count; index += 1) {
      const jitter = (axis: number): number =>
        (((index * 31 + axis * 17) % 101) / 101 - 0.5) * wobble;
      position.setXYZ(
        index,
        position.getX(index) + jitter(1),
        position.getY(index) + jitter(2),
        position.getZ(index) + jitter(3),
      );
    }
    position.needsUpdate = true;
    return { edges, radius };
  }, [geometry]);
  /**
   * ONE memo owns the state-dependent line resources (material + line) so the
   * deferred-dispose hook has a single generation to track per state change.
   * The wobble geometry is BORROWED from edgeRig: a hover/state flip replaces
   * the material but reuses those edges, so they must never be freed here.
   */
  const rig = useMemo(() => {
    const material = new THREE.LineDashedMaterial({
      color: state === 'zone' ? PALETTE.brassLight : DESIGN_TOKENS.state.focus,
      dashSize: Math.max(0.012, edgeRig.radius * 0.14),
      gapSize: Math.max(0.006, edgeRig.radius * 0.05),
      transparent: true,
      opacity: affordanceOpacity(state),
      depthWrite: false,
    });
    const line = new THREE.LineSegments(edgeRig.edges, material);
    line.computeLineDistances();
    return { material, line };
  }, [edgeRig, state]);

  // A state change replaces ONLY the material: the new line still draws the
  // borrowed edges, so disposing them here would churn/free an in-use buffer.
  // Depending on [rig] queues exactly one disposal per replaced generation.
  useDeferredDispose(() => {
    rig.material.dispose();
  }, [rig]);

  // Edges belong to the SOURCE GEOMETRY generation, not to hover state: free
  // them only on a true unmount (or a genuine source-geometry change).
  useDeferredDispose(() => {
    edgeRig.edges.dispose();
  }, [edgeRig]);

  if (state === 'idle') return null;
  return (
    <primitive
      object={rig.line}
      name={name}
      position={[...position]}
      rotation={rotation ? [...rotation] : undefined}
      scale={scale ? [...scale] : undefined}
      renderOrder={2}
    />
  );
}
