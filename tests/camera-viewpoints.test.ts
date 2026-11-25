/**
 * Camera viewpoint selection (REWORK_PLAN §3.3, commit 5): pure data, so it is
 * tested without a WebGL context. Viewpoints must be distinct, finite and
 * derived from the same furniture placement used to build the room.
 */
import { describe, expect, it } from 'vitest';
import type { Route } from '../src/lib/router';
import {
  DESK_TOP_HEIGHT,
  MONITOR_SCREEN_LOCAL_Y,
} from '../src/scene/art/geometry';
import {
  DESK_POSITION,
  MONITOR_DESK_OFFSET,
  MONITOR_POSITION,
  SCREEN_POSITION,
  SHELF_POSITION,
} from '../src/scene/placement';
import {
  BOOK_VIEWPOINT,
  CASE_VIEWPOINT,
  getCameraViewpoint,
  getZoneViewpoint,
  HOME_VIEWPOINT,
  MONITOR_VIEWPOINT,
  ZONE_VIEWPOINTS,
} from '../src/scene/viewpoints';

describe('zone viewpoints', () => {
  it('covers every route with a finite position and target', () => {
    const routes: Route[] = [
      '/',
      '/about',
      '/experience',
      '/projects',
      '/climate',
    ];
    for (const route of routes) {
      const vp = getZoneViewpoint(route);
      for (const value of [...vp.position, ...vp.target]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(vp.position).toHaveLength(3);
      expect(vp.target).toHaveLength(3);
    }
  });

  it('gives each zone a distinct framing (no accidental duplicates)', () => {
    const keys = Object.values(ZONE_VIEWPOINTS).map(
      (vp) => `${vp.position.join(',')}|${vp.target.join(',')}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('starts at the establishing home shot', () => {
    expect(getZoneViewpoint('/')).toBe(HOME_VIEWPOINT);
    expect(HOME_VIEWPOINT.position[2]).toBeGreaterThan(0);
  });

  it('derives framings from the placement constants', () => {
    expect(ZONE_VIEWPOINTS['/about'].target[0]).toBeCloseTo(
      DESK_POSITION[0] - 0.35,
    );
    expect(ZONE_VIEWPOINTS['/about'].target[1]).toBeCloseTo(
      DESK_TOP_HEIGHT + 0.12,
    );
    expect(ZONE_VIEWPOINTS['/experience'].target[2]).toBe(SHELF_POSITION[2]);
    expect(ZONE_VIEWPOINTS['/climate'].target[2]).toBe(SCREEN_POSITION[2]);
  });

  it('falls back to home for an unknown route', () => {
    expect(getZoneViewpoint('#/nope' as Route)).toBe(HOME_VIEWPOINT);
  });

  it('pulls the camera back for mobile portrait without moving the target', () => {
    const landscape = getZoneViewpoint('/about');
    const portrait = getZoneViewpoint('/about', {
      portrait: true,
      tier: 'mobile',
    });
    expect(portrait.target).toBe(landscape.target);
    expect(portrait.position[2]).toBeGreaterThan(landscape.position[2]);
    expect(portrait.position[1]).toBeGreaterThan(landscape.position[1]);
    for (const value of portrait.position) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('keeps the landscape framing outside the mobile-portrait variant', () => {
    expect(
      getZoneViewpoint('/climate', { portrait: true, tier: 'desktop' }),
    ).toBe(getZoneViewpoint('/climate'));
    expect(getZoneViewpoint('/', { portrait: false, tier: 'mobile' })).toBe(
      HOME_VIEWPOINT,
    );
  });

  it('applies the mobile-portrait pullback on resize for every zone without mutating shared constants', () => {
    const routes: Route[] = [
      '/',
      '/about',
      '/experience',
      '/projects',
      '/climate',
    ];
    for (const route of routes) {
      const landscape = getZoneViewpoint(route);
      const before = JSON.stringify(landscape);
      const portrait = getZoneViewpoint(route, {
        portrait: true,
        tier: 'mobile',
      });
      expect(portrait).not.toBe(landscape);
      expect(portrait.position[2]).toBeGreaterThanOrEqual(
        landscape.position[2],
      );
      expect(portrait.target).toEqual(landscape.target);
      // A resize must be a pure lookup — the base viewpoint is untouched.
      expect(JSON.stringify(landscape)).toBe(before);
    }
  });
});

describe('monitor desktop zoom viewpoint (commit 7)', () => {
  it('derives the close-up from the same monitor placement as the mesh', () => {
    expect(MONITOR_POSITION[0]).toBeCloseTo(
      DESK_POSITION[0] + MONITOR_DESK_OFFSET[0],
    );
    expect(MONITOR_POSITION[2]).toBeCloseTo(
      DESK_POSITION[2] + MONITOR_DESK_OFFSET[2],
    );
    expect(MONITOR_VIEWPOINT.target[1]).toBeCloseTo(
      MONITOR_POSITION[1] + MONITOR_SCREEN_LOCAL_Y,
    );
    // Camera sits in front of the screen (larger z) and looks straight at it.
    expect(MONITOR_VIEWPOINT.position[2]).toBeGreaterThan(
      MONITOR_VIEWPOINT.target[2],
    );
    expect(MONITOR_VIEWPOINT.position[0]).toBeCloseTo(
      MONITOR_VIEWPOINT.target[0],
    );
    for (const value of [
      ...MONITOR_VIEWPOINT.position,
      ...MONITOR_VIEWPOINT.target,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('flies to the monitor when open and back to the zone when closed', () => {
    const zone = getZoneViewpoint('/about');
    expect(getCameraViewpoint('/about', true)).toBe(MONITOR_VIEWPOINT);
    expect(getCameraViewpoint('/about', false)).toBe(zone);
    // Any zone returns to its own framing on close.
    expect(getCameraViewpoint('/climate', false)).toBe(
      getZoneViewpoint('/climate'),
    );
  });

  it('applies the mobile-portrait pullback to the close-up too', () => {
    const landscape = getCameraViewpoint('/about', true);
    const portrait = getCameraViewpoint('/about', true, {
      portrait: true,
      tier: 'mobile',
    });
    expect(portrait.target).toBe(landscape.target);
    expect(portrait.position[2]).toBeGreaterThan(landscape.position[2]);
  });
});

describe('in-world detail close-ups (polish(c))', () => {
  it('derives book/case framings from the same furniture placement', () => {
    expect(BOOK_VIEWPOINT.target[0]).toBeCloseTo(SHELF_POSITION[0] + 0.6);
    expect(BOOK_VIEWPOINT.target[2]).toBeCloseTo(SHELF_POSITION[2] - 0.6);
    // The camera stands in front of the shelf (larger world x).
    expect(BOOK_VIEWPOINT.position[0]).toBeGreaterThan(
      BOOK_VIEWPOINT.target[0],
    );
    expect(CASE_VIEWPOINT.target[0]).toBeCloseTo(DESK_POSITION[0] + 0.25);
    expect(CASE_VIEWPOINT.target[1]).toBeCloseTo(DESK_TOP_HEIGHT + 0.5);
    expect(CASE_VIEWPOINT.position[2]).toBeGreaterThan(
      CASE_VIEWPOINT.target[2],
    );
    for (const vp of [BOOK_VIEWPOINT, CASE_VIEWPOINT]) {
      for (const value of [...vp.position, ...vp.target]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it('selects the detail viewpoint only when a detail is open', () => {
    expect(getCameraViewpoint('/experience', false, {}, 'book')).toBe(
      BOOK_VIEWPOINT,
    );
    expect(getCameraViewpoint('/projects', false, {}, 'case')).toBe(
      CASE_VIEWPOINT,
    );
    expect(getCameraViewpoint('/about', true, {}, 'monitor')).toBe(
      MONITOR_VIEWPOINT,
    );
    // No detail → the zone framing is untouched.
    expect(getCameraViewpoint('/experience', false, {})).toBe(
      getZoneViewpoint('/experience'),
    );
  });
});
