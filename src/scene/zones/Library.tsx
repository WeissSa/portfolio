/**
 * The Library — Experience (REWORK_PLAN §3.2.1, commit 6).
 *
 * One pickable book per POST: a single InstancedMesh holds the 13 bodies
 * (per-instance color, featured volumes larger + brass/red), and all 13 spine
 * labels share ONE extra geometry whose UVs point into the book-spine atlas —
 * two draw calls for the whole interactive shelf. Pointer picking writes ids
 * into the zustand store; the SAME accessible DOM components read them back,
 * so no content is ever trapped in the canvas (screen readers use the 2D list
 * and the shared detail overlay). Headless render tests verify structure only;
 * pixel-level appearance needs a real browser (§6 screenshot review).
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { POSTS, postId } from '../../content/posts';
import { usePortfolioStore } from '../../state/store';
import {
  bookAtlasRows,
  createLibraryBooks,
  createSpineLabelsGeometry,
  type LibraryBook,
  type ShelfCell,
} from '../art/geometry';
import type { RoomMaterials } from '../art/materials';

/** How far a selected volume slides toward the viewer ("pulls it out"). */
const PULL_OUT = 0.13;

export interface LibraryZoneProps {
  cells: readonly ShelfCell[];
  materials: RoomMaterials;
}

export function LibraryZone({ cells, materials }: LibraryZoneProps) {
  const books = useMemo<LibraryBook[]>(
    () =>
      createLibraryBooks(
        cells,
        POSTS.map((post) => ({ id: postId(post), featured: post.featured })),
      ),
    [cells],
  );
  const bodyGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const labelsGeometry = useMemo(
    () => createSpineLabelsGeometry(books, bookAtlasRows(books.length)),
    [books],
  );
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((state) => state.invalidate);

  const hoveredPostId = usePortfolioStore((state) => state.hoveredPostId);
  const selectedPostId = usePortfolioStore((state) => state.selectedPostId);
  const setHoveredPost = usePortfolioStore((state) => state.setHoveredPost);
  const selectPost = usePortfolioStore((state) => state.selectPost);

  // Refresh instance transforms/colours on mount and on hover/selection change.
  // Scratch objects are allocated once per effect (not per frame) and the
  // demand loop is invalidated so the new pose is actually drawn.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    const highlight = new THREE.Color('#fff3d0');
    books.forEach((book, index) => {
      position.set(...book.position);
      if (book.id === selectedPostId) position.z += PULL_OUT;
      scale.set(...book.scale);
      matrix.makeScale(scale.x, scale.y, scale.z);
      matrix.setPosition(position);
      mesh.setMatrixAt(index, matrix);
      color.set(book.color);
      if (book.id === selectedPostId || book.id === hoveredPostId) {
        color.lerp(highlight, 0.4);
      }
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    invalidate();
  }, [books, hoveredPostId, selectedPostId, invalidate]);

  // New GPU resources belong to this zone, not the shell: tear them down if
  // the library unmounts on a mode toggle (the shared atlas/material live in
  // RoomMaterials and are freed by disposeRoomMaterials).
  useEffect(
    () => () => {
      bodyGeometry.dispose();
      labelsGeometry.dispose();
      document.body.style.cursor = '';
    },
    [bodyGeometry, labelsGeometry],
  );

  const bookAt = (instanceId: number | undefined): LibraryBook | undefined =>
    instanceId === undefined ? undefined : books[instanceId];

  const onPointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const book = bookAt(event.instanceId);
    if (!book) return;
    setHoveredPost(book.id);
    document.body.style.cursor = 'pointer';
    invalidate();
  };

  const onPointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHoveredPost(null);
    document.body.style.cursor = '';
    invalidate();
  };

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const book = bookAt(event.instanceId);
    if (book) selectPost(book.id);
  };

  if (books.length === 0) return null;

  return (
    <group name="library-books">
      <instancedMesh
        ref={meshRef}
        args={[bodyGeometry, materials.bookHero, books.length]}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        frustumCulled={false}
      />
      <mesh
        geometry={labelsGeometry}
        material={materials.bookAtlas}
        frustumCulled={false}
      />
    </group>
  );
}
