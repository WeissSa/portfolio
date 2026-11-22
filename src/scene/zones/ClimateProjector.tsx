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
import { useEffect, useMemo } from 'react';
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
import { usePortfolioStore } from '../../state/store';
import type { RoomMaterials } from '../art/materials';

export const PROJECTOR_TEXTURE_WIDTH = 1024;
export const PROJECTOR_TEXTURE_HEIGHT = 576;

const CLOTH = '#d9cdb2';
const INK = '#161616';
const RED = '#c8102e';
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
  ctx.fillStyle = '#f2e9d0';
  ctx.font = `bold 22px ${DISPLAY_FONT}`;
  ctx.fillText(
    'IS TODAY WEIRDLY HOT/COLD?',
    PROJECTOR_TEXTURE_WIDTH / 2,
    plaqueY + 8,
  );
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(todayLabel, PROJECTOR_TEXTURE_WIDTH / 2, plaqueY + 36);

  // Full attribution links live in the accessible DOM panel; the projected
  // line still names both sources so the room reads as the real widget.
  ctx.fillStyle = INK;
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText(CLIMATE_ATTRIBUTION_LINE, PROJECTOR_TEXTURE_WIDTH / 2, 492);
  ctx.fillStyle = RED;
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText(
    `${CLIMATE_ATTRIBUTION.supportLabel} ${CLIMATE_ATTRIBUTION.climateDefenseFund.label}`,
    PROJECTOR_TEXTURE_WIDTH / 2,
    526,
  );

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
}

export function ClimateProjector({
  screenGeometry,
  materials,
  canvasFactory = browserClimateCanvas,
}: ClimateProjectorProps) {
  const climate = usePortfolioStore((state) => state.climate);
  const loadClimate = usePortfolioStore((state) => state.loadClimate);
  const selectedYear = usePortfolioStore((state) => state.selectedClimateYear);
  const setSelectedClimateYear = usePortfolioStore(
    (state) => state.setSelectedClimateYear,
  );
  const openClimatePanel = usePortfolioStore((state) => state.openClimatePanel);
  const invalidate = useThree((state) => state.invalidate);

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

  const texture = useMemo(
    () => buildProjectorTexture(cells, renderYear, todayLabel, canvasFactory),
    [cells, renderYear, todayLabel, canvasFactory],
  );

  // One owned material per texture; both are disposed when the year/data
  // changes or the room unmounts on a mode toggle. Without a 2D context the
  // room-owned screenFabric is borrowed (and left to Room's teardown).
  const material = useMemo(() => {
    if (!texture) return materials.screenFabric;
    return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  }, [texture, materials.screenFabric]);

  useEffect(() => {
    // Demand frameloop: redraw once when the projected data/year changes.
    invalidate();
    return () => {
      if (material !== materials.screenFabric) material.dispose();
      texture?.dispose();
    };
  }, [material, texture, materials.screenFabric, invalidate]);

  // The dial's two meshes are owned by this zone (Room only owns the cloth).
  const prevGeometry = useMemo(
    () => new THREE.BoxGeometry(0.13, 0.13, 0.04),
    [],
  );
  const nextGeometry = useMemo(
    () => new THREE.BoxGeometry(0.13, 0.13, 0.04),
    [],
  );
  useEffect(
    () => () => {
      prevGeometry.dispose();
      nextGeometry.dispose();
      document.body.style.cursor = '';
    },
    [prevGeometry, nextGeometry],
  );

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

  const onScreenClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    // Content stays in DOM: this only opens the shared ClimateView dialog.
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
          position={[-0.22, -0.65, 0.03]}
          onClick={stepYear('prev')}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        />
        <mesh
          name="climate-year-next"
          geometry={nextGeometry}
          material={materials.brass}
          position={[0.22, -0.65, 0.03]}
          onClick={stepYear('next')}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        />
      </group>
    </group>
  );
}
