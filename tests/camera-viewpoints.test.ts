/**
 * Camera viewpoint selection (REWORK_PLAN §3.3, commit 5): pure data, so it is
 * tested without a WebGL context. Viewpoints must be distinct, finite and
 * derived from the same furniture placement used to build the room.
 */
import { describe, expect, it } from 'vitest';
import type { Route } from '../src/lib/router';
import { DESK_TOP_HEIGHT } from '../src/scene/art/geometry';
import {
  DESK_POSITION,
  SCREEN_POSITION,
  SHELF_POSITION,
} from '../src/scene/placement';
import {
  getZoneViewpoint,
  HOME_VIEWPOINT,
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
});
