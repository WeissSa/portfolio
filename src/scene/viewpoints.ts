/**
 * Per-zone camera viewpoints (REWORK_PLAN §3.3/§4.2, commit 5).
 *
 * Every framing is derived from the furniture placement constants so a tweak
 * to the room layout moves the camera with it. Pure data + a lookup helper —
 * no three/R3F import — so viewpoint selection is unit-testable headlessly.
 */
import type { Route } from '../lib/router';
import { DESK_TOP_HEIGHT, type Vec3 } from './art/geometry';
import { DESK_POSITION, SCREEN_POSITION, SHELF_POSITION } from './placement';

export interface ZoneViewpoint {
  /** Camera world position. */
  position: Vec3;
  /** Point the camera looks at (damped alongside position). */
  target: Vec3;
}

/** Home / establishing shot — also the camera's start pose on mount. */
export const HOME_VIEWPOINT: ZoneViewpoint = {
  position: [0, 1.65, 4.8],
  target: [0, 1.35, -1.2],
};

export const ZONE_VIEWPOINTS: Record<Route, ZoneViewpoint> = {
  '/': HOME_VIEWPOINT,
  // The Desk — About: frame the monitor on the desktop.
  '/about': {
    position: [
      DESK_POSITION[0] + 0.25,
      DESK_TOP_HEIGHT + 1.0,
      DESK_POSITION[2] + 2.0,
    ],
    target: [
      DESK_POSITION[0] - 0.35,
      DESK_TOP_HEIGHT + 0.12,
      DESK_POSITION[2] - 0.18,
    ],
  },
  // The Library — Experience: face the bookshelf head-on.
  '/experience': {
    position: [SHELF_POSITION[0] + 2.35, 1.6, SHELF_POSITION[2] + 0.1],
    target: [SHELF_POSITION[0], 1.45, SHELF_POSITION[2]],
  },
  // Game cases on the desk shelf — Projects: look down at the cases.
  '/projects': {
    position: [
      DESK_POSITION[0] - 0.15,
      DESK_TOP_HEIGHT + 0.95,
      DESK_POSITION[2] + 1.55,
    ],
    target: [
      DESK_POSITION[0] - 0.15,
      DESK_TOP_HEIGHT + 0.05,
      DESK_POSITION[2] + 0.18,
    ],
  },
  // The Projector screen — Climate: stand back and face the screen.
  '/climate': {
    position: [SCREEN_POSITION[0] + 2.15, 1.8, SCREEN_POSITION[2] + 3.1],
    target: [SCREEN_POSITION[0], SCREEN_POSITION[1], SCREEN_POSITION[2]],
  },
};

/** Safe lookup (unknown hashes are normalised to '/' by the router). */
export function getZoneViewpoint(route: Route): ZoneViewpoint {
  return ZONE_VIEWPOINTS[route] ?? HOME_VIEWPOINT;
}
