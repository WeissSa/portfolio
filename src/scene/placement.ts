/**
 * Furniture placement constants (ladder commit 4; extracted in commit 5).
 *
 * Originally the constants at the top of Room.tsx. They live in their own
 * dependency-free module so both Room.tsx (geometry layout) and viewpoints.ts
 * (camera framings) derive from one source of truth without a circular
 * Room ↔ CameraRig import.
 */
import { DESK_TOP_HEIGHT, ROOM_DIMS, type Vec3 } from './art/geometry';

export const DESK_POSITION: Vec3 = [1.9, 0, -2.55];
/** Monitor group's position relative to the desk group (Room.tsx). */
export const MONITOR_DESK_OFFSET: Vec3 = [
  -0.35,
  DESK_TOP_HEIGHT + 0.035,
  -0.18,
];
/** Monitor group's world position — the desktop-zoom camera derives its
 * close-up from this so camera and mesh can never drift apart. */
export const MONITOR_POSITION: Vec3 = [
  DESK_POSITION[0] + MONITOR_DESK_OFFSET[0],
  DESK_POSITION[1] + MONITOR_DESK_OFFSET[1],
  DESK_POSITION[2] + MONITOR_DESK_OFFSET[2],
];
export const SHELF_POSITION: Vec3 = [-3.55, 0, -0.4];
export const SHELF_ROTATION: Vec3 = [0, Math.PI / 2, 0];
export const LAMP_POSITION: Vec3 = [3.15, 0, 1.7];
export const RUG_POSITION: Vec3 = [-0.4, 0.012, 0.7];
export const WINDOW_POSITION: Vec3 = [ROOM_DIMS.width / 2 - 0.02, 1.75, -0.5];
export const WINDOW_ROTATION: Vec3 = [0, -Math.PI / 2, 0];
/** The projector perches on the bookshelf crown and throws at the screen. */
export const PROJECTOR_POSITION: Vec3 = [-3.5, 2.3, -0.4];
export const PROJECTOR_ROTATION: Vec3 = [-0.176, -0.624, 0];
export const SCREEN_POSITION: Vec3 = [-1.35, 1.7, -ROOM_DIMS.depth / 2 + 0.03];
export const FRAME_POSITIONS: [Vec3, number][] = [
  [[-0.1, 2.0, -ROOM_DIMS.depth / 2 + 0.03], 0],
  [[0.65, 1.85, -ROOM_DIMS.depth / 2 + 0.03], 1],
  [[-3.2, 1.9, -ROOM_DIMS.depth / 2 + 0.03], 2],
];
