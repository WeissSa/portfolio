/**
 * Commit 4 — canonical diegetic plaque, bidirectional sync and reduced-motion
 * contracts. Pure framing math is measured with the SAME camera as Room.tsx;
 * pixel-level occlusion is asserted in scripts/qa/diegetic.spec.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../src/lib/router';
import {
  canOptIntoReducedMotion3d,
  readReducedMotionOptIn,
  writeReducedMotionOptIn,
  type DeviceCapabilities,
} from '../src/lib/device-tier';
import { DESIGN_TOKENS } from '../src/styles/design-tokens';
import { usePortfolioStore } from '../src/state/store';
import {
  DIEGETIC_ROWS,
  HOME_FOV_DEGREES,
  PLAQUE,
  framingCamera,
  isWithinView,
  plaqueProjection,
  projectCapHeight,
  textureGlyphWorldHeight,
} from '../src/scene/diegetic';
import { HOME_VIEWPOINT } from '../src/scene/viewpoints';
import { createWallPlaque } from '../src/scene/art/geometry';
import { planWallPlaque } from '../src/scene/art/textures';
import { plaqueRowY } from '../src/scene/zones/WallPlaque';
import { advancePainterlyTime } from '../src/scene/effects/PainterlyPass';
import { roomShadowSettings } from '../src/scene/Room';

const VIEWPORT = { width: 1440, height: 900 };
const CAPS: DeviceCapabilities = {
  webgl2: true,
  deviceMemory: 8,
  hardwareConcurrency: 8,
  saveData: false,
  pointerType: 'fine',
  reducedMotion: true,
};

beforeEach(() => {
  writeReducedMotionOptIn(false);
  usePortfolioStore.getState().setMenuFocusRoute(null);
  usePortfolioStore.getState().setMenuHoverRoute(null);
});

describe('wall plaque framing (HOME_VIEWPOINT)', () => {
  it('uses the same five routes, in order, as the DOM menu', () => {
    expect(DIEGETIC_ROWS.map((row) => row.route)).toEqual([...ROUTES]);
  });

  it('is framed, at least 1.5 m wide, inside the home frustum', () => {
    expect(PLAQUE.width).toBeGreaterThanOrEqual(1.5);
    const camera = framingCamera(HOME_VIEWPOINT, VIEWPORT, HOME_FOV_DEGREES);
    expect(isWithinView(camera, PLAQUE.position)).toBe(true);
    const { rect } = plaqueProjection(HOME_VIEWPOINT, VIEWPORT);
    expect(rect.width).toBeGreaterThan(100);
    expect(rect.left).toBeGreaterThan(0);
    expect(rect.right).toBeLessThan(VIEWPORT.width);
    // Clean left band of the 3D desktop layout (DOM content starts at 50%).
    expect(rect.right).toBeLessThan(VIEWPORT.width * 0.5);
  });

  it('renders caps >= 20 px and >= 28px texel font on a dark inlay', () => {
    const { capHeightPx } = plaqueProjection(HOME_VIEWPOINT, VIEWPORT);
    expect(capHeightPx).toBeGreaterThanOrEqual(PLAQUE.minCapPx);
    expect(PLAQUE.fontPx).toBeGreaterThanOrEqual(28);
    const worldCap = textureGlyphWorldHeight(
      PLAQUE.fontPx,
      PLAQUE.textureHeight,
      PLAQUE.height,
    );
    expect(
      projectCapHeight(
        framingCamera(HOME_VIEWPOINT, VIEWPORT),
        PLAQUE.position,
        worldCap,
        VIEWPORT,
      ),
    ).toBeCloseTo(capHeightPx);
  });

  it('paints gilt lettering only on ink — never gold on brass', () => {
    const plan = planWallPlaque('smoke');
    const texts = plan.ops.filter((op) => op.kind === 'text');
    expect(texts).toHaveLength(5);
    for (const op of texts) {
      if (op.kind !== 'text') continue;
      expect(op.color).toBe(DESIGN_TOKENS.climate.projectorPlaqueText);
      expect(op.font).toContain(`${PLAQUE.fontPx}px`);
    }
    expect(plan.width).toBe(PLAQUE.textureWidth);
    expect(plan.height).toBe(PLAQUE.textureHeight);
    expect(plan.ops.length).toBeLessThan(100);
  });

  it('builds a beveled board with brass frame, rosettes and a purple inlay', () => {
    const parts = createWallPlaque('smoke');
    const ids = parts.map((part) => part.id);
    for (const id of [
      'plaque-board',
      'plaque-inlay-panel',
      'plaque-lettered-face',
      'plaque-brass-frame',
      'plaque-purple-inlay',
    ]) {
      expect(ids).toContain(id);
    }
    expect(ids.filter((id) => id.startsWith('plaque-rosette'))).toHaveLength(4);
    const face = parts.find((part) => part.id === 'plaque-lettered-face');
    expect(face?.material).toBe('plaqueFace');
    expect(
      parts.find((part) => part.id === 'plaque-purple-inlay')?.material,
    ).toBe('plaqueAccent');
  });

  it('places five descending, evenly spaced pickable rows', () => {
    const rows = DIEGETIC_ROWS.map((_, index) => plaqueRowY(index));
    expect(rows).toHaveLength(5);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!).toBeLessThan(rows[i - 1]!);
      expect(rows[i - 1]! - rows[i]!).toBeCloseTo(rows[0]! - rows[1]!);
    }
  });
});

describe('bidirectional DOM ↔ in-world sync', () => {
  it('DOM focus writes the canonical route; in-world hover writes the twin', () => {
    const store = usePortfolioStore.getState();
    store.setMenuFocusRoute('/projects');
    expect(usePortfolioStore.getState().menuFocusRoute).toBe('/projects');
    store.setMenuHoverRoute('/climate');
    expect(usePortfolioStore.getState().menuHoverRoute).toBe('/climate');
    // Focus wins the single-highlight precedence.
    expect(
      usePortfolioStore.getState().menuFocusRoute ??
        usePortfolioStore.getState().menuHoverRoute,
    ).toBe('/projects');
  });

  it('clears 3D-only hover/focus state on leaving 3D', () => {
    usePortfolioStore.setState({
      menuFocusRoute: '/about',
      menuHoverRoute: '/',
      mode: '3d',
    });
    usePortfolioStore.getState().setMode('2d');
    expect(usePortfolioStore.getState().menuFocusRoute).toBeNull();
    expect(usePortfolioStore.getState().menuHoverRoute).toBeNull();
  });
});

describe('reduced-motion 3D and shadow gating', () => {
  it('freezes the grain clock only when requested', () => {
    expect(advancePainterlyTime(3, 0.016)).toBeCloseTo(3.016);
    expect(advancePainterlyTime(3, 0.016, true)).toBe(3);
  });

  it('offers the informed opt-in only when reduced motion is the sole gate', () => {
    expect(canOptIntoReducedMotion3d(CAPS)).toBe(true);
    expect(canOptIntoReducedMotion3d({ ...CAPS, saveData: true })).toBe(false);
    expect(canOptIntoReducedMotion3d({ ...CAPS, webgl2: false })).toBe(false);
    expect(canOptIntoReducedMotion3d({ ...CAPS, reducedMotion: false })).toBe(
      false,
    );
    writeReducedMotionOptIn(true);
    expect(readReducedMotionOptIn()).toBe(true);
    writeReducedMotionOptIn(false);
    expect(readReducedMotionOptIn()).toBe(false);
  });

  it('allocates shadows only on the desktop Canvas', () => {
    expect(roomShadowSettings('desktop')).toEqual({
      canvasShadows: true,
      keyLight: true,
    });
    expect(roomShadowSettings('mobile')).toEqual({
      canvasShadows: false,
      keyLight: false,
    });
    expect(roomShadowSettings('low')).toEqual({
      canvasShadows: false,
      keyLight: false,
    });
  });

  it('does not break when localStorage is unavailable', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    expect(readReducedMotionOptIn()).toBe(false);
    expect(() => writeReducedMotionOptIn(true)).not.toThrow();
    spy.mockRestore();
  });
});
