/**
 * Game cases — Projects (REWORK_PLAN §3.2.3, commit 8).
 *
 * Each of the five desk-shelf cases is a distinct pick target. Clicking one
 * opens a single `{ kind: 'project', id }` detail; the SAME accessible PostCard
 * used by the 2D Projects list then renders in the one focus-managed DOM
 * dialog, so no detail content ever lives in the canvas. Hover sets
 * `hoveredProjectId` (the 2D card highlights in parity) and the pointer cursor.
 *
 * The selected case's lid lifts + tilts open; the hovered case lifts slightly.
 * Both are damped scalars animated in useFrame with three preallocated number
 * arrays — no per-frame allocations, and the demand loop is only invalidated
 * while a case is actually moving (or when hover/selection changes).
 *
 * No GPU resources are created here: bodies and lids are the room-owned
 * RoomParts from createGameCases() and use RoomMaterials. Headless tests are
 * structural only; pixel-level appearance needs a browser screenshot review.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { PROJECTS, postId } from '../../content/posts';
import { focusDetailTrigger } from '../../lib/detail-mode';
import { PickableEdges, pickAffordance, useZoneSpotlight } from '../affordance';
import { selectProjectDetailId, usePortfolioStore } from '../../state/store';
import type { RoomPart } from '../art/geometry';
import type { RoomMaterials } from '../art/materials';

/** Selected lid: lift + hinge tilt (radians) for the "case opens" read. */
const OPEN_LIFT = 0.07;
const OPEN_TILT = -1.05;
/** Hovered-only lift — enough to show the case is live without opening it. */
const HOVER_LIFT = 0.014;
const DAMP_LAMBDA = 9;
const SETTLE_EPSILON = 0.001;

export interface ProjectCasesProps {
  /** The `case-body-i` / `case-lid-i` RoomParts from createGameCases(). */
  cases: readonly RoomPart[];
  materials: RoomMaterials;
}

export function ProjectCases({ cases, materials }: ProjectCasesProps) {
  const projectIds = useMemo(() => PROJECTS.map(postId), []);
  // Pair body + lid by their generated ids; a missing part simply renders no
  // interactive case rather than throwing (defensive against seed changes).
  const pairs = useMemo(
    () =>
      projectIds.map((_id, index) => ({
        body: cases.find((part) => part.id === `case-body-${index}`),
        lid: cases.find((part) => part.id === `case-lid-${index}`),
      })),
    [cases, projectIds],
  );

  const selectedProjectId = usePortfolioStore(selectProjectDetailId);
  const hoveredProjectId = usePortfolioStore((state) => state.hoveredProjectId);
  const openDetail = usePortfolioStore((state) => state.openDetail);
  const setHoveredProject = usePortfolioStore(
    (state) => state.setHoveredProject,
  );
  const invalidate = useThree((state) => state.invalidate);
  // Projects-zone spotlight: thin gold edges on every case once the camera
  // settles; the hovered/selected case gets the brighter treatment.
  const spotlight = useZoneSpotlight('/projects');

  // Refs into the lid groups + the damped animation state. Plain number arrays
  // allocated once: useFrame only reads/writes them, never creates objects.
  const lidRefs = useRef<(THREE.Group | null)[]>([]);
  const open = useRef<number[]>(projectIds.map(() => 0));
  const lift = useRef<number[]>(projectIds.map(() => 0));

  // Draw the new pose when hover/selection changes even if the loop is idle.
  useEffect(() => {
    invalidate();
  }, [selectedProjectId, hoveredProjectId, invalidate]);

  // A hover ended by a zone switch (unmount) must not leave a sticky cursor.
  useEffect(() => () => void (document.body.style.cursor = ''), []);

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.1);
    let animating = false;
    for (let index = 0; index < projectIds.length; index += 1) {
      const group = lidRefs.current[index];
      if (!group) continue;
      const id = projectIds[index];
      const selected = id === selectedProjectId;
      const hovered = id === hoveredProjectId;
      const openTarget = selected ? 1 : 0;
      const liftTarget = hovered ? 1 : 0;
      const nextOpen = THREE.MathUtils.damp(
        open.current[index] ?? 0,
        openTarget,
        DAMP_LAMBDA,
        dt,
      );
      const nextLift = THREE.MathUtils.damp(
        lift.current[index] ?? 0,
        liftTarget,
        DAMP_LAMBDA,
        dt,
      );
      open.current[index] = nextOpen;
      lift.current[index] = nextLift;

      const baseY = pairs[index]?.lid?.position?.[1] ?? 0;
      group.position.y = baseY + nextOpen * OPEN_LIFT + nextLift * HOVER_LIFT;
      group.rotation.x = nextOpen * OPEN_TILT;

      if (
        Math.abs(nextOpen - openTarget) > SETTLE_EPSILON ||
        Math.abs(nextLift - liftTarget) > SETTLE_EPSILON
      ) {
        animating = true;
      }
    }
    if (animating) invalidate();
  });

  const pick = (index: number): string | undefined => projectIds[index];

  const onClick = (index: number) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const id = pick(index);
    if (id) {
      focusDetailTrigger();
      openDetail({ kind: 'project', id });
    }
  };
  const onPointerOver =
    (index: number) => (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      const id = pick(index);
      if (!id) return;
      setHoveredProject(id);
      document.body.style.cursor = 'pointer';
      invalidate();
    };
  const onPointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHoveredProject(null);
    document.body.style.cursor = '';
    invalidate();
  };

  // A picked case keeps its lid-lift/tilt gesture; the readable card is the
  // visible DOM panel (painted in-world text was truncated and clipped).
  return (
    <group name="game-cases">
      {pairs.map(({ body, lid }, index) => {
        const id = projectIds[index];
        if (!id || !body || !lid) return null;
        return (
          <group
            key={id}
            name={`game-case-${id}`}
            onClick={onClick(index)}
            onPointerOver={onPointerOver(index)}
            onPointerOut={onPointerOut}
          >
            <mesh
              geometry={body.geometry}
              material={materials[body.material]}
              position={body.position}
              rotation={body.rotation}
              scale={body.scale}
            />
            <PickableEdges
              geometry={body.geometry}
              position={body.position ?? [0, 0, 0]}
              rotation={body.rotation ?? [0, 0, 0]}
              scale={body.scale ?? [1, 1, 1]}
              state={pickAffordance(
                id === hoveredProjectId,
                id === selectedProjectId,
                spotlight,
              )}
              name={`case-affordance-${id}`}
            />
            <group
              ref={(node) => {
                lidRefs.current[index] = node;
              }}
              position={lid.position}
            >
              <mesh
                geometry={lid.geometry}
                material={materials[lid.material]}
                rotation={lid.rotation}
                scale={lid.scale}
              />
            </group>
          </group>
        );
      })}
    </group>
  );
}
