/**
 * Per-zone camera viewpoints (REWORK_PLAN §3.3/§4.2, commit 5).
 *
 * Every framing is derived from the furniture placement constants so a tweak
 * to the room layout moves the camera with it. Pure data + a lookup helper —
 * no three/R3F import — so viewpoint selection is unit-testable headlessly.
 */
import type { DeviceTier } from '../lib/device-tier';
import type { Route } from '../lib/router';
import { CLIMATE_VIEWPOINT_DATA, HOME_VIEWPOINT_DATA } from './diegetic';
import {
  DESK_TOP_HEIGHT,
  MONITOR_SCREEN_LOCAL_Y,
  type Vec3,
} from './art/geometry';
import {
  DESK_POSITION,
  MONITOR_POSITION,
  SCREEN_POSITION,
  SHELF_POSITION,
} from './placement';

export interface ZoneViewpoint {
  /** Camera world position. */
  position: Vec3;
  /** Point the camera looks at (damped alongside position). */
  target: Vec3;
}

/**
 * Home / establishing shot — also the camera's start pose on mount. The
 * target sits to the right of centre so the diegetic wall plaque (above/right
 * of the desk) lands in the CLEAN LEFT BAND of the 3D desktop DOM layout;
 * the screen, desk and window stay in shot (commit 4 framing test).
 */
export const HOME_VIEWPOINT: ZoneViewpoint = HOME_VIEWPOINT_DATA;

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
  // The Projector screen — Climate: close enough that the projected
  // climate-local strip (year / back / info) is legible (4b framing test).
  '/climate': CLIMATE_VIEWPOINT_DATA,
};

/**
 * Close-up of the monitor screen — the camera pose while the 3D monitor's
 * full-screen desktop-OS overlay is open (REWORK_PLAN §3.2.2, commit 7). The
 * camera sits a short distance in front of the screen and looks straight at
 * it; on close, CameraRig flies back to the active zone's normal viewpoint.
 */
export const MONITOR_VIEWPOINT: ZoneViewpoint = {
  position: [
    MONITOR_POSITION[0],
    MONITOR_POSITION[1] + MONITOR_SCREEN_LOCAL_Y,
    MONITOR_POSITION[2] + 0.62,
  ],
  target: [
    MONITOR_POSITION[0],
    MONITOR_POSITION[1] + MONITOR_SCREEN_LOCAL_Y,
    MONITOR_POSITION[2] + 0.03,
  ],
};

export interface ViewpointOptions {
  /** True when the viewport is taller than wide (mobile portrait). */
  portrait?: boolean;
  /** Render tier; only the mobile tier uses the portrait variant (§3.6). */
  tier?: DeviceTier;
}

/**
 * Pull-back factor for mobile portrait. A tall/narrow frustum clips the
 * landscape-composed room, so the camera retreats along its own view vector
 * (and lifts slightly to keep the floor in frame) while still looking at the
 * same zone target. Pure arithmetic — no three/DOM dependency.
 */
const PORTRAIT_PULLBACK = 1.32;
const PORTRAIT_LIFT = 0.08;

function withPortrait(
  base: ZoneViewpoint,
  options: ViewpointOptions,
): ZoneViewpoint {
  if (!options.portrait || options.tier !== 'mobile') return base;
  const [px, py, pz] = base.position;
  const [tx, ty, tz] = base.target;
  return {
    position: [
      tx + (px - tx) * PORTRAIT_PULLBACK,
      ty + (py - ty) * PORTRAIT_PULLBACK + PORTRAIT_LIFT,
      tz + (pz - tz) * PORTRAIT_PULLBACK,
    ],
    target: base.target,
  };
}

/** Safe lookup (unknown hashes are normalised to '/' by the router). */
export function getZoneViewpoint(
  route: Route,
  options: ViewpointOptions = {},
): ZoneViewpoint {
  return withPortrait(ZONE_VIEWPOINTS[route] ?? HOME_VIEWPOINT, options);
}

/**
 * Camera pose for the current UI state: the monitor close-up while the desktop
 * zoom is open, otherwise the active zone's (optionally portrait-adjusted)
 * viewpoint. Pure data — no three/R3F — so the fly-in/fly-back decision is
 * unit-testable without a WebGL context.
 */
export function getCameraViewpoint(
  route: Route,
  desktopOpen: boolean,
  options: ViewpointOptions = {},
): ZoneViewpoint {
  const base = desktopOpen
    ? MONITOR_VIEWPOINT
    : (ZONE_VIEWPOINTS[route] ?? HOME_VIEWPOINT);
  return withPortrait(base, options);
}
