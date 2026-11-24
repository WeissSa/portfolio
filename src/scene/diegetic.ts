/**
 * Diegetic menu geometry + framing constants (art-overhaul commit 4/4b).
 *
 * The WALL PLAQUE is the one canonical global navigation surface. The CRT dock
 * mirrors it only in the monitor close-up; the projector strip is a
 * climate-zone-LOCAL menu (year / back / info), never a second global nav.
 * Pure data + a perspective-projector helper, so the Playwright frustum /
 * occlusion harness and the unit tests measure the SAME numbers the room uses.
 */
import * as THREE from 'three';
import type { Route } from '../lib/router';
import type { Vec3 } from './art/geometry';
import type { ZoneViewpoint } from './viewpoints';

/** Must match the <Canvas camera fov> in Room.tsx (and the QA projector). */
export const HOME_FOV_DEGREES = 50;

/**
 * Camera framings the QA harness needs. Kept in this JSON-free module (no
 * design-tokens import) so Playwright can load them directly in Node; the
 * canonical `viewpoints.ts` re-exports the very same object identities.
 */
export const HOME_VIEWPOINT_DATA: { position: Vec3; target: Vec3 } = {
  position: [0, 1.65, 4.8],
  target: [2.5, 1.45, -1.2],
};
export const CLIMATE_VIEWPOINT_DATA: { position: Vec3; target: Vec3 } = {
  // Derived from SCREEN_POSITION = [-1.35, 1.7, -3.47] in placement.ts. The
  // target is deliberately right of the screen so the projected LOCAL menu
  // strip falls in the clean left band of the 3D desktop layout (4b test).
  position: [0.8, 1.75, -1.07],
  target: [-0.5, 1.7, -3.47],
};

export interface DiegeticRow {
  route: Route;
  label: string;
}

/** Canonical row order — identical to ROUTES / the DOM menu link order. */
export const DIEGETIC_ROWS: readonly DiegeticRow[] = [
  { route: '/', label: 'Home' },
  { route: '/about', label: 'About' },
  { route: '/experience', label: 'Experience' },
  { route: '/projects', label: 'Projects' },
  { route: '/climate', label: 'Climate' },
];

/**
 * Brass-and-wood wall plaque. Mounted on the back wall ABOVE / RIGHT OF THE
 * DESK (desk x=1.9), facing the establishing camera. The home viewpoint aims
 * slightly right so the plaque lands in the clean left band of the 3D DOM
 * layout while the desk, screen and window remain in shot.
 *
 * Texture 512×320 with a 60px display face => 5 rows × 60px + margins; the
 * glyph is 0.1875 m tall in a 1 m plaque, ~21 px at the HOME_VIEWPOINT on a
 * 900px-tall viewport (the QA harness asserts >= 20px).
 */
export const PLAQUE = {
  // Back wall is z = -3.5 (ROOM_DIMS.depth / 2); the face sits 6cm forward.
  position: [2.4, 2.0, -3.44] as Vec3,
  width: 1.6,
  height: 1.0,
  textureWidth: 512,
  textureHeight: 320,
  fontPx: 60,
  rowBaselines: [38, 100, 162, 224, 286] as const,
  minCapPx: 20,
} as const;

/** CRT dock mirrors the five routes at the bottom of the monitor texture. */
export const CRT_DOCK = {
  textureWidth: 512,
  textureHeight: 320,
  /** Texture-space x of the five dock labels (shared by paint + hit planes). */
  hitXs: [130, 190, 250, 310, 370] as const,
  /** Hit-plane width / height in monitor-local metres (desk group origin). */
  hitWidth: 0.09,
  hitHeight: 0.05,
  hitY: 0.33,
  hitZ: 0.033,
  /** Camera must be closer than this to treat the CRT as the highlighted surface. */
  closeUpDistance: 1.35,
} as const;

/**
 * Projected panel: a CLIMATE-LOCAL strip painted into the bottom of the live
 * heatmap texture (year dial + back + info). Not a global nav duplicate.
 */
export const PROJECTED_PANEL = {
  /** Screen centre in world space (SCREEN_POSITION from placement.ts). */
  center: [-1.35, 1.7, -3.45] as Vec3,
  screenWidth: 1.9,
  screenHeight: 1.07,
  textureWidth: 1024,
  textureHeight: 576,
  stripHeight: 64,
  fontPx: 32,
  minCapPx: 16,
} as const;

export interface ProjectedRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Camera identical to the R3F <Canvas> camera used by Room. */
export function framingCamera(
  viewpoint: ZoneViewpoint,
  viewport: { width: number; height: number },
  fov = HOME_FOV_DEGREES,
): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    fov,
    viewport.width / viewport.height,
    0.1,
    60,
  );
  camera.position.set(...viewpoint.position);
  camera.lookAt(new THREE.Vector3(...viewpoint.target));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function toScreen(
  point: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  viewport: { width: number; height: number },
): [number, number] {
  const ndc = point.clone().project(camera);
  return [
    ((ndc.x + 1) / 2) * viewport.width,
    ((1 - ndc.y) / 2) * viewport.height,
  ];
}

/**
 * Project an axis-aligned wall-facing rectangle into CSS pixels. The plaque,
 * CRT dock and projector strip are all wall/monitor-plane quads (no yaw aside
 * from the monitor's tiny seeded yaw, handled by the pick handler).
 */
export function projectWorldRect(
  camera: THREE.PerspectiveCamera,
  center: Vec3,
  width: number,
  height: number,
  viewport: { width: number; height: number },
): ProjectedRect {
  const corners: [number, number][] = [];
  for (const dx of [-width / 2, width / 2]) {
    for (const dy of [-height / 2, height / 2]) {
      corners.push(
        toScreen(
          new THREE.Vector3(center[0] + dx, center[1] + dy, center[2]),
          camera,
          viewport,
        ),
      );
    }
  }
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

/** Pixel height of a glyph of the given WORLD height at the rectangle's centre. */
export function projectCapHeight(
  camera: THREE.PerspectiveCamera,
  center: Vec3,
  worldCapHeight: number,
  viewport: { width: number; height: number },
): number {
  const a = toScreen(
    new THREE.Vector3(center[0], center[1] + worldCapHeight / 2, center[2]),
    camera,
    viewport,
  );
  const b = toScreen(
    new THREE.Vector3(center[0], center[1] - worldCapHeight / 2, center[2]),
    camera,
    viewport,
  );
  return Math.abs(a[1] - b[1]);
}

/** Glyph height in metres for a texture-painted lettering strip. */
export function textureGlyphWorldHeight(
  fontPx: number,
  textureHeightPx: number,
  worldHeight: number,
): number {
  return (fontPx / textureHeightPx) * worldHeight;
}

export function plaqueProjection(
  viewpoint: ZoneViewpoint,
  viewport: { width: number; height: number },
): { rect: ProjectedRect; capHeightPx: number } {
  const camera = framingCamera(viewpoint, viewport);
  return {
    rect: projectWorldRect(
      camera,
      PLAQUE.position,
      PLAQUE.width,
      PLAQUE.height,
      viewport,
    ),
    capHeightPx: projectCapHeight(
      camera,
      PLAQUE.position,
      textureGlyphWorldHeight(
        PLAQUE.fontPx,
        PLAQUE.textureHeight,
        PLAQUE.height,
      ),
      viewport,
    ),
  };
}

/**
 * True when the plaque centre is inside the camera frustum (all four clip
 * coordinates within the [-1,1] cube). Also used by the framing QA assertion.
 */
export function isWithinView(
  camera: THREE.PerspectiveCamera,
  point: Vec3,
): boolean {
  const ndc = new THREE.Vector3(...point).project(camera);
  return (
    Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z >= -1 && ndc.z <= 1
  );
}
