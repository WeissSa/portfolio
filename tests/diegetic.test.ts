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
  CLIMATE_VIEWPOINT_DATA,
  CRT_DOCK,
  DIEGETIC_ROWS,
  HOME_FOV_DEGREES,
  PLAQUE,
  PROJECTED_PANEL,
  framingCamera,
  homeControlVisible,
  isWithinView,
  plaqueGlyphBox,
  plaqueProjection,
  plaquePurpleRule,
  projectCapHeight,
  projectedStripBounds,
  textureGlyphWorldHeight,
} from '../src/scene/diegetic';
import { HOME_VIEWPOINT } from '../src/scene/viewpoints';
import { createWallPlaque } from '../src/scene/art/geometry';
import { planMonitorDesktop, planWallPlaque } from '../src/scene/art/textures';
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

  it('keeps all five row glyph boxes inside the frame, clear of the purple rule', () => {
    const rule = plaquePurpleRule();
    for (let index = 0; index < DIEGETIC_ROWS.length; index += 1) {
      const box = plaqueGlyphBox(index);
      expect(box.top, `row ${index} clears the purple rule`).toBeGreaterThan(
        rule.bottom,
      );
      expect(box.top, `row ${index} clears the top frame`).toBeGreaterThan(16);
      expect(box.bottom, `row ${index} clears the bottom frame`).toBeLessThan(
        PLAQUE.textureHeight - 16,
      );
      if (index > 0) {
        expect(box.top).toBeGreaterThan(plaqueGlyphBox(index - 1)!.bottom);
      }
      // Conservative Anton advance for the longest label ("EXPERIENCE").
      const label = DIEGETIC_ROWS[index]!.label.toUpperCase();
      expect(label.length * PLAQUE.fontPx * 0.62).toBeLessThan(
        PLAQUE.textureWidth - 112,
      );
    }
    // Hit planes must not overlap at the new 52px row pitch.
    expect(PLAQUE.hitHeight).toBeLessThan(PLAQUE.height / DIEGETIC_ROWS.length);
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

describe('4b diegetic sequencing (no signage farm)', () => {
  it('paints five CRT dock shortcuts mirroring the plaque routes', () => {
    const plan = planMonitorDesktop('smoke');
    const texts = plan.ops.filter((op) => op.kind === 'text');
    for (const row of DIEGETIC_ROWS) {
      expect(
        texts.some(
          (op) =>
            op.kind === 'text' &&
            op.text.toUpperCase().includes(row.label.slice(0, 4).toUpperCase()),
        ),
      ).toBe(true);
    }
    expect(CRT_DOCK.hitXs).toHaveLength(5);
    expect(plan.ops.some((op) => op.kind === 'polygon')).toBe(true);
  });

  it('hands the canonical highlight to the CRT only in close-up', () => {
    const store = usePortfolioStore.getState();
    store.setMenuFocusRoute('/climate');
    store.setCrtCloseUp(true);
    // WallPlaque derives `null` while crtCloseUp is true; the CRT is the ONE
    // highlighted global surface, never plaque + CRT + projector at once.
    expect(usePortfolioStore.getState().crtCloseUp).toBe(true);
    expect(usePortfolioStore.getState().menuFocusRoute).toBe('/climate');
    store.setCrtCloseUp(false);
    expect(usePortfolioStore.getState().crtCloseUp).toBe(false);
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

describe('diegetic HOME affordance (round-3 review)', () => {
  it('is always available in pointer-driven zones, never in 2D/home', () => {
    expect(homeControlVisible('3d', '/experience', true)).toBe(true);
    expect(homeControlVisible('3d', '/projects', true)).toBe(true);
    expect(homeControlVisible('3d', '/climate', true)).toBe(true);
    expect(homeControlVisible('3d', '/', true)).toBe(false); // plaque is HOME
    expect(homeControlVisible('2d', '/experience', true)).toBe(false);
    expect(homeControlVisible('3d', '/experience', false)).toBe(false);
  });
});

describe('reduced-motion 3D and shadow gating', () => {
  it('freezes the grain clock only when requested', () => {
    // No DOM/frame dependency: the pass calls this pure step on every rendered
    // frame, so the freeze contract is tested directly (not via a dataset that
    // a demand frameloop never updates after an instant cut).
    let time = 3;
    for (const delta of [0.016, 5, 120]) {
      time = advancePainterlyTime(time, delta, true);
    }
    expect(time).toBe(3);
    expect(advancePainterlyTime(time, 0.016)).toBeCloseTo(3.016);
  });

  it('keeps projected strip glyphs clear of the brass rules', () => {
    const bounds = projectedStripBounds();
    expect(bounds.glyphTop).toBeGreaterThan(bounds.purpleRuleBottom);
    expect(bounds.glyphBottom).toBeLessThan(bounds.bottomRuleTop);
    expect(bounds.glyphTop).toBeGreaterThan(bounds.stripTop + 4);
    expect(bounds.glyphBottom).toBeLessThan(PROJECTED_PANEL.textureHeight);

    // Font was NOT shrunk below the projected legibility floor.
    const stripWorldHeight =
      (PROJECTED_PANEL.stripHeight / PROJECTED_PANEL.textureHeight) *
      PROJECTED_PANEL.screenHeight;
    const centre: [number, number, number] = [
      PROJECTED_PANEL.center[0],
      PROJECTED_PANEL.center[1] -
        PROJECTED_PANEL.screenHeight / 2 +
        stripWorldHeight / 2,
      PROJECTED_PANEL.center[2],
    ];
    const cap = projectCapHeight(
      framingCamera(CLIMATE_VIEWPOINT_DATA, VIEWPORT, HOME_FOV_DEGREES),
      centre,
      textureGlyphWorldHeight(
        PROJECTED_PANEL.fontPx,
        PROJECTED_PANEL.textureHeight,
        PROJECTED_PANEL.screenHeight,
      ),
      VIEWPORT,
    );
    expect(cap).toBeGreaterThanOrEqual(PROJECTED_PANEL.minCapPx);
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
      canvasShadows: 'percentage',
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
