import { describe, expect, it } from 'vitest';
import { isRoute, navigate, parseRoute, ROUTES } from '../src/lib/router';

describe('parseRoute', () => {
  it('maps known hashes to routes', () => {
    expect(parseRoute('#/')).toBe('/');
    expect(parseRoute('#/about')).toBe('/about');
    expect(parseRoute('#/experience')).toBe('/experience');
    expect(parseRoute('#/projects')).toBe('/projects');
    expect(parseRoute('#/climate')).toBe('/climate');
  });

  it('falls back to / for empty or unknown hashes', () => {
    expect(parseRoute('')).toBe('/');
    expect(parseRoute('#')).toBe('/');
    expect(parseRoute('#/nope')).toBe('/');
    expect(parseRoute('#/climate-change')).toBe('/');
  });

  it('tolerates trailing slashes', () => {
    expect(parseRoute('#/about/')).toBe('/about');
    expect(parseRoute('#/climate//')).toBe('/climate');
  });
});

describe('isRoute', () => {
  it('accepts every declared route', () => {
    for (const route of ROUTES) {
      expect(isRoute(route)).toBe(true);
    }
  });
});

describe('navigate', () => {
  it('sets the location hash', () => {
    navigate('/climate');
    expect(window.location.hash).toBe('#/climate');
  });
});
