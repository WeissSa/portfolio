/**
 * The Projector — Climate (REWORK_PLAN §3.2.4 / §4.4, commit 9).
 *
 * The wall screen no longer shows a static title card: its material map is a
 * THREE.CanvasTexture painted by the SAME pure `drawHeatmap()` routine the 2D
 * widget uses, plus the title, the "Is Today Weirdly Hot/Cold?" verdict and the
 * Open-Meteo / Climate Defense Fund attributions. A year dial (two pickable
 * meshes) writes the SHARED `selectedClimateYear` store field; clicking the
 * screen opens the accessible DOM dialog (`ClimateProjectorPanel`) — no climate
 * content is ever canvas-only. The room-owned projector body + additive light
 * cone stay untouched in Room.tsx.
 *
 * Picking follows the established zone pattern: group handlers stop
 * propagation, and the whole canvas is pointer-events:none until
 * `.scene-layer--interactive` (ready + fine pointer) opts it back in, so
 * keyboard/SR visitors always use the DOM equivalent. Headless R3F tests are
 * structural only; pixel-level appearance needs a browser screenshot review.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import {
  CLIMATE_ATTRIBUTION,
  CLIMATE_ATTRIBUTION_LINE,
  CLIMATE_TITLE,
} from '../../content/climate';
import {
  availableYears,
  heatmapForYear,
  LEVEL_COLORS,
  reconcileSelectedYear,
  todayComparison,
  yearsWithData,
  type HeatmapCell,
} from '../../lib/climate';
import {
  drawHeatmap,
  heatmapSize,
  type HeatmapPalette,
} from '../../lib/climate-draw';
import { navigateAndCloseDetail } from '../../lib/navigation';
import { PALETTE } from '../art/palette';
import { useDeferredDispose } from '../../lib/deferred-dispose';
import { focusDetailTrigger } from '../../lib/detail-mode';
import { PickableEdges, pickAffordance, useZoneSpotlight } from '../affordance';
import { PROJECTED_PANEL, projectedStripBounds } from '../diegetic';
import { DESIGN_TOKENS } from '../../styles/design-tokens';
import { usePortfolioStore } from '../../state/store';
import type { RoomMaterials } from '../art/materials';

export const PROJECTOR_TEXTURE_WIDTH = 1024;
export const PROJECTOR_TEXTURE_HEIGHT = 576;
/** 3c P7: at most ten painted years stay resident; LRU-ish FIFO eviction. */
export const MAX_PROJECTOR_TEXTURE_CACHE = 10;

const CLOTH = DESIGN_TOKENS.climate.projectorCloth;
const INK = DESIGN_TOKENS.climate.projectorInk;
const RED = DESIGN_TOKENS.climate.projectorRed;
const DISPLAY_FONT = "'Anton', 'Arial Narrow', Haettenschweiler, sans-serif";

/** Ink-on-cloth palette for the projected heatmap (DOM canvas uses the default). */
const PROJECTOR_PALETTE: HeatmapPalette = {
  colors: LEVEL_COLORS,
  text: INK,
  background: CLOTH,
};

/** Injection seam: jsdom has no 2D canvas, so tests pass a recording context. */
export type ClimateCanvasFactory = (
  width: number,
  height: number,
) => HTMLCanvasElement;

export const browserClimateCanvas: ClimateCanvasFactory = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

/**
 * Paint a projector screen texture. Returns `null` when no 2D context exists
 * (headless jsdom / software-disabled canvas) so callers can fall back to the
 * room's static screenFabric material instead of crashing.
 */
export function buildProjectorTexture(
  cells: readonly HeatmapCell[],
  year: number,
  todayLabel: string,
  canvasFactory: ClimateCanvasFactory = browserClimateCanvas,
): THREE.CanvasTexture | null {
  const canvas = canvasFactory(
    PROJECTOR_TEXTURE_WIDTH,
    PROJECTOR_TEXTURE_HEIGHT,
  );
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Cloth backing + jagged P5 title card.
  ctx.fillStyle = CLOTH;
  ctx.fillRect(0, 0, PROJECTOR_TEXTURE_WIDTH, PROJECTOR_TEXTURE_HEIGHT);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `bold 56px ${DISPLAY_FONT}`;
  ctx.fillText(CLIMATE_TITLE.toUpperCase(), PROJECTOR_TEXTURE_WIDTH / 2, 34);
  ctx.fillStyle = RED;
  ctx.font = `30px ${DISPLAY_FONT}`;
  ctx.fillText(
    `HISTORICAL WEATHER HEATMAP · ${year}`,
    PROJECTOR_TEXTURE_WIDTH / 2,
    104,
  );

  // The heatmap itself — one shared drawing routine with the 2D widget.
  const { width: heatWidth, height: heatHeight } = heatmapSize(cells, year);
  const heatX = Math.max(
    12,
    Math.round((PROJECTOR_TEXTURE_WIDTH - heatWidth) / 2),
  );
  const heatY = 150;
  ctx.save();
  ctx.translate(heatX, heatY);
  drawHeatmap(ctx, cells, year, PROJECTOR_PALETTE);
  ctx.restore();

  // "Is Today Weirdly Hot/Cold?" plaque painted below the heatmap.
  const plaqueY = heatY + heatHeight + 24;
  ctx.fillStyle = INK;
  ctx.fillRect(48, plaqueY, PROJECTOR_TEXTURE_WIDTH - 96, 66);
  ctx.textAlign = 'center';
  ctx.fillStyle = DESIGN_TOKENS.climate.projectorPlaqueText;
  ctx.font = `bold 22px ${DISPLAY_FONT}`;
  ctx.fillText(
    'IS TODAY WEIRDLY HOT/COLD?',
    PROJECTOR_TEXTURE_WIDTH / 2,
    plaqueY + 8,
  );
  ctx.fillStyle = DESIGN_TOKENS.climate.heatmapLabelText;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(todayLabel, PROJECTOR_TEXTURE_WIDTH / 2, plaqueY + 36);

  // Full attribution links live in the accessible DOM panel; the projected
  // line still names both sources so the room reads as the real widget.
  ctx.fillStyle = INK;
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText(CLIMATE_ATTRIBUTION_LINE, PROJECTOR_TEXTURE_WIDTH / 2, 446);
  ctx.fillStyle = RED;
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText(
    `${CLIMATE_ATTRIBUTION.supportLabel} ${CLIMATE_ATTRIBUTION.climateDefenseFund.label}`,
    PROJECTOR_TEXTURE_WIDTH / 2,
    478,
  );

  // Commit 4b: CLIMATE-LOCAL menu strip (year / back / info) painted into the
  // bottom of the SAME projected texture. Not a duplicate of the global nav.
  const bounds = projectedStripBounds();
  const stripTop = bounds.stripTop;
  ctx.fillStyle = INK;
  ctx.fillRect(
    0,
    stripTop,
    PROJECTOR_TEXTURE_WIDTH,
    PROJECTED_PANEL.stripHeight,
  );
  // Brass frame + purple rule: the strip reads as part of the screen rather
  // than text floating on the wall; gilt lettering stays on the dark inlay.
  ctx.fillStyle = PALETTE.brassLight;
  ctx.fillRect(18, stripTop + 3, PROJECTOR_TEXTURE_WIDTH - 36, 3);
  ctx.fillRect(18, bounds.bottomRuleTop, PROJECTOR_TEXTURE_WIDTH - 36, 3);
  ctx.fillStyle = DESIGN_TOKENS.p5.link;
  ctx.fillRect(24, bounds.purpleRuleTop, PROJECTOR_TEXTURE_WIDTH - 48, 2);
  ctx.fillStyle = PALETTE.brassDark;
  for (const divider of [0.44, 0.69]) {
    ctx.fillRect(
      PROJECTOR_TEXTURE_WIDTH * divider,
      stripTop + 8,
      2,
      PROJECTED_PANEL.stripHeight - 16,
    );
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = DESIGN_TOKENS.climate.projectorPlaqueText;
  ctx.font = `bold ${PROJECTED_PANEL.fontPx}px ${DISPLAY_FONT}`;
  const items = ['YEAR ◀ ▶', 'BACK', 'INFO'];
  items.forEach((label, index) => {
    ctx.fillText(
      label,
      [
        PROJECTOR_TEXTURE_WIDTH * 0.3,
        PROJECTOR_TEXTURE_WIDTH * 0.58,
        PROJECTOR_TEXTURE_WIDTH * 0.8,
      ][index]!,
      PROJECTED_PANEL.textBaseline,
    );
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface ClimateProjectorProps {
  /** Room-owned screen plane geometry (disposed by Room, not by this zone). */
  screenGeometry: THREE.BufferGeometry;
  materials: RoomMaterials;
  /** Headless-test seam; defaults to a real browser canvas. */
  canvasFactory?: ClimateCanvasFactory;
  /**
   * 3c P7: mobile/low tiers skip the 1024×576 canvas upload until the visitor
   * actually enters the climate zone. Desktop always paints immediately.
   */
  deferUntilZone?: boolean;
}

export function ClimateProjector({
  screenGeometry,
  materials,
  canvasFactory = browserClimateCanvas,
  deferUntilZone = false,
}: ClimateProjectorProps) {
  const climate = usePortfolioStore((state) => state.climate);
  const activeZone = usePortfolioStore((state) => state.activeZone);
  const loadClimate = usePortfolioStore((state) => state.loadClimate);
  const selectedYear = usePortfolioStore((state) => state.selectedClimateYear);
  const setSelectedClimateYear = usePortfolioStore(
    (state) => state.setSelectedClimateYear,
  );
  const openClimatePanel = usePortfolioStore((state) => state.openClimatePanel);
  const invalidate = useThree((state) => state.invalidate);
  // Climate-zone spotlight: the year dial + back/info strip gain gold edges
  // after the camera settles, matching the plaque/CRT/book/case affordances.
  const spotlight = useZoneSpotlight('/climate');
  const [dialHover, setDialHover] = useState<'prev' | 'next' | null>(null);

  // Cached: loadClimate bails out when status is ready/loading, so mounting the
  // room (or re-entering the zone) never refetches the API/snapshot (§4.4).
  useEffect(() => {
    void loadClimate();
  }, [loadClimate]);

  // Derive the selectable years from the loaded dataset exactly like the 2D
  // widget: a last-good snapshot may end in a prior year. This runs in EVERY
  // 3D zone (not just #/climate), so the shared stored year must be reconciled
  // here too or the projector paints an all-gray "no data" grid.
  const years = useMemo(() => {
    const withData = yearsWithData(climate.historical);
    return withData.length > 0
      ? withData
      : availableYears(new Date().getFullYear());
  }, [climate.historical]);

  const renderYear = reconcileSelectedYear(selectedYear, years);

  useEffect(() => {
    if (years.length > 0 && renderYear !== selectedYear) {
      setSelectedClimateYear(renderYear);
    }
  }, [years, renderYear, selectedYear, setSelectedClimateYear]);

  const cells = useMemo<HeatmapCell[]>(
    () =>
      climate.status === 'ready'
        ? heatmapForYear(climate.historical, renderYear)
        : [],
    [climate.historical, climate.status, renderYear],
  );

  const todayLabel = useMemo(() => {
    if (climate.currentTemp === null) {
      return 'Live temperature unavailable — historical heatmap only';
    }
    const comparison = todayComparison(
      climate.historical,
      climate.currentTemp,
      new Date(),
    );
    if (!comparison) return 'Today’s comparison is unavailable';
    const direction = comparison.difference > 0 ? 'HOTTER' : 'COLDER';
    return `${climate.currentTemp.toFixed(1)}°C — ${Math.abs(comparison.difference).toFixed(1)}°C ${direction} THAN USUAL`;
  }, [climate.currentTemp, climate.historical]);

  // 3c P7: mobile/low tiers stay on the room's static screenFabric until the
  // climate zone is entered (sticky — leaving the zone keeps the painted map).
  const paintedRef = useRef(!deferUntilZone);
  if (activeZone === '/climate') paintedRef.current = true;
  const shouldPaint = paintedRef.current;

  // A per-dataset cache removes the 1024×576 canvas repaint + GPU upload spike
  // when the year dial is clicked back and forth. New data starts a new cache;
  // the effect disposes every texture in the old one (no leak across toggles).
  // The deps intentionally START A NEW CACHE (and dispose the old one) when the
  // dataset/label/factory changes; the memo body itself needs no values.
  const cache = useMemo(
    () => new Map<string, THREE.CanvasTexture>(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [climate.historical, climate.status, todayLabel, canvasFactory],
  );
  useDeferredDispose(() => {
    for (const cached of cache.values()) cached.dispose();
    cache.clear();
  }, [cache]);

  const textureKey = `${renderYear}|${todayLabel}`;
  const texture = useMemo(() => {
    if (!shouldPaint) return null;
    const cached = cache.get(textureKey);
    if (cached) return cached;
    const built = buildProjectorTexture(
      cells,
      renderYear,
      todayLabel,
      canvasFactory,
    );
    if (!built) return null;
    cache.set(textureKey, built);
    if (cache.size > MAX_PROJECTOR_TEXTURE_CACHE) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) {
        cache.get(oldest)?.dispose();
        cache.delete(oldest);
      }
    }
    return built;
  }, [
    cache,
    cells,
    renderYear,
    todayLabel,
    textureKey,
    canvasFactory,
    shouldPaint,
  ]);

  // One lightweight material per texture; the CACHED textures outlive material
  // swaps and are disposed by the cache effect, never on a year change.
  // Without a 2D context the room-owned screenFabric is borrowed.
  const material = useMemo(() => {
    if (!texture) return materials.screenFabric;
    return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  }, [texture, materials.screenFabric]);

  useEffect(() => {
    // Demand frameloop: redraw once when the projected data/year changes.
    invalidate();
  }, [material, materials.screenFabric, invalidate]);
  useDeferredDispose(() => {
    if (material !== materials.screenFabric) material.dispose();
  }, [material, materials.screenFabric]);

  // The dial's two meshes are owned by this zone (Room only owns the cloth).
  const prevGeometry = useMemo(
    () => new THREE.BoxGeometry(0.13, 0.13, 0.04),
    [],
  );
  const nextGeometry = useMemo(
    () => new THREE.BoxGeometry(0.13, 0.13, 0.04),
    [],
  );
  useDeferredDispose(() => {
    prevGeometry.dispose();
    nextGeometry.dispose();
  }, [prevGeometry, nextGeometry]);
  useEffect(() => () => void (document.body.style.cursor = ''), []);

  // `years` is newest-first: ◀ steps toward older years, ▶ toward newer ones.
  // Step from the RENDERED year so a stale stored year cannot strand the dial.
  const stepYear =
    (direction: 'prev' | 'next') => (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      const index = years.indexOf(renderYear);
      const target =
        direction === 'prev'
          ? years[index < 0 ? 0 : Math.min(index + 1, years.length - 1)]
          : years[index < 0 ? 0 : Math.max(index - 1, 0)];
      if (target !== undefined && target !== renderYear) {
        setSelectedClimateYear(target);
      }
    };

  // Local panel highlight is deliberately SEPARATE from the canonical global
  // nav highlight: it never lights the plaque or the CRT (no triple flash).
  const [localItem, setLocalItem] = useState<'back' | 'info' | null>(null);
  const localGeometry = useMemo(
    () =>
      new THREE.PlaneGeometry(
        0.34,
        (PROJECTED_PANEL.stripHeight / PROJECTED_PANEL.textureHeight) *
          PROJECTED_PANEL.screenHeight,
      ),
    [],
  );
  const localMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: DESIGN_TOKENS.state.focus,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    [],
  );
  // Transparent (not `visible={false}`) so the local hit planes stay raycastable.
  const hitMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );
  useDeferredDispose(() => {
    localGeometry.dispose();
    localMaterial.dispose();
    hitMaterial.dispose();
  }, [localGeometry, localMaterial, hitMaterial]);

  const stripY =
    -PROJECTED_PANEL.screenHeight / 2 +
    ((PROJECTED_PANEL.stripHeight / PROJECTED_PANEL.textureHeight) *
      PROJECTED_PANEL.screenHeight) /
      2;
  const localPick =
    (item: 'back' | 'info') => (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      setLocalItem(null);
      if (item === 'back') navigateAndCloseDetail('/');
      else {
        focusDetailTrigger();
        openClimatePanel();
      }
    };
  const localHover =
    (item: 'back' | 'info') => (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      setLocalItem(item);
      document.body.style.cursor = 'pointer';
    };

  const localOut = () => {
    setLocalItem(null);
    document.body.style.cursor = '';
  };

  const onScreenClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    // The projected panel already shows climate data in-world; INFO paints the
    // fuller card below. The DOM mirror is the fallback/a11y path.
    focusDetailTrigger();
    openClimatePanel();
  };
  const onPointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    document.body.style.cursor = 'pointer';
  };
  const onPointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    document.body.style.cursor = '';
  };
  const onDialOver =
    (direction: 'prev' | 'next') => (event: ThreeEvent<PointerEvent>) => {
      onPointerOver(event);
      setDialHover(direction);
    };
  const onDialOut = (event: ThreeEvent<PointerEvent>) => {
    onPointerOut(event);
    setDialHover(null);
  };

  return (
    <group name="climate-projector-content">
      <group
        name="projector-screen-texture"
        onClick={onScreenClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <mesh geometry={screenGeometry} material={material} />
      </group>
      <group name="climate-year-dial">
        <mesh
          name="climate-year-prev"
          geometry={prevGeometry}
          material={materials.brass}
          position={[-0.38, stripY, 0.03]}
          onClick={stepYear('prev')}
          onPointerOver={onDialOver('prev')}
          onPointerOut={onDialOut}
        />
        <PickableEdges
          geometry={prevGeometry}
          position={[-0.38, stripY, 0.03]}
          state={pickAffordance(dialHover === 'prev', false, spotlight)}
          name="projected-prev-affordance"
        />
        <mesh
          name="climate-year-next"
          geometry={nextGeometry}
          material={materials.brass}
          position={[-0.2, stripY, 0.03]}
          onClick={stepYear('next')}
          onPointerOver={onDialOver('next')}
          onPointerOut={onDialOut}
        />
        <PickableEdges
          geometry={nextGeometry}
          position={[-0.2, stripY, 0.03]}
          state={pickAffordance(dialHover === 'next', false, spotlight)}
          name="projected-next-affordance"
        />
      </group>
      {/* Climate-zone-LOCAL menu: back / info hit planes inside the painted
          strip. The year dial above is the third local control. */}
      <group name="climate-local-menu">
        {(
          [
            ['back', 0.152],
            ['info', 0.57],
          ] as const
        ).map(([item, x]) => (
          <group key={item}>
            <mesh
              name={`projected-${item}`}
              geometry={localGeometry}
              material={hitMaterial}
              position={[x, stripY, 0.032]}
              onClick={localPick(item)}
              onPointerOver={localHover(item)}
              onPointerOut={localOut}
            />
            {localItem === item && (
              <mesh
                name={`projected-${item}-highlight`}
                geometry={localGeometry}
                material={localMaterial}
                position={[x, stripY, 0.028]}
              />
            )}
            <PickableEdges
              geometry={localGeometry}
              position={[x, stripY, 0.03]}
              state={pickAffordance(localItem === item, false, spotlight)}
              name={`projected-${item}-affordance`}
            />
          </group>
        ))}
      </group>
    </group>
  );
}
