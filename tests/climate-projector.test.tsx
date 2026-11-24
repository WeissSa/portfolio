/**
 * Climate projector (REWORK_PLAN §3.2.4 / §4.4, commit 9): live heatmap
 * CanvasTexture created by the SHARED drawHeatmap routine, year dial → store →
 * texture redraw, CanvasTexture disposal, the accessible DOM dialog with the
 * same content as 2D, keyboard operation and the unchanged 2D route.
 *
 * R3F tests are structural only (no pixel verification — that needs a browser
 * screenshot review). jsdom has no 2D canvas, so a recording context is
 * injected via the zone's canvasFactory seam.
 */
import { act, screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from './helpers';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import App from '../src/App';
import {
  CLIMATE_ATTRIBUTION,
  CLIMATE_ATTRIBUTION_LINE,
  CLIMATE_STATEMENT,
  CLIMATE_TITLE,
} from '../src/content/climate';
import { flatToHistorical, type HeatmapCell } from '../src/lib/climate';
import { ClimateView } from '../src/ui/ClimateView';
import { ClimateProjectorPanel } from '../src/ui/ClimateProjectorPanel';
import {
  buildProjectorTexture,
  ClimateProjector,
  type ClimateCanvasFactory,
} from '../src/scene/zones/ClimateProjector';
import {
  createRoomMaterials,
  disposeRoomMaterials,
  type RoomMaterials,
} from '../src/scene/art/materials';
import { usePortfolioStore } from '../src/state/store';

// jsdom has no WebGL2: stub the lazy scene so forcing 3D mode never creates a
// Canvas (capability gates + error boundary have their own tests).
vi.mock('../src/ui/SceneLayer', () => ({
  SceneLayer: () => <div data-testid="scene-stub" />,
}));

interface RecordedCall {
  method: string;
  args: unknown[];
  fillStyle?: string;
}

function recordingFactory() {
  const calls: RecordedCall[] = [];
  const ctx = {
    fillStyle: '',
    font: '',
    textBaseline: '',
    textAlign: 'left',
    clearRect: (...args: unknown[]) =>
      calls.push({ method: 'clearRect', args }),
    fillRect: (...args: unknown[]) =>
      calls.push({ method: 'fillRect', args, fillStyle: ctx.fillStyle }),
    fillText: (...args: unknown[]) =>
      calls.push({ method: 'fillText', args, fillStyle: ctx.fillStyle }),
    save: () => calls.push({ method: 'save', args: [] }),
    restore: () => calls.push({ method: 'restore', args: [] }),
    translate: (...args: unknown[]) =>
      calls.push({ method: 'translate', args }),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
  const factory: ClimateCanvasFactory = (width, height) => {
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };
  return { factory, calls, canvas };
}

const noContextFactory: ClimateCanvasFactory = (width, height) =>
  ({
    width,
    height,
    getContext: () => null,
  }) as unknown as HTMLCanvasElement;

const SMALL_CELLS: HeatmapCell[] = [
  { date: '2024-01-01', level: 3, temp: 2, mean: 2, hottestOnRecord: false },
  { date: '2024-02-01', level: 6, temp: 20, mean: 2, hottestOnRecord: true },
];

const HISTORICAL = flatToHistorical({
  '2020-01-01': 5,
  '2023-06-15': 18,
  '2024-06-15': 22,
  '2025-06-15': 25,
});

function readyClimate() {
  return {
    status: 'ready' as const,
    source: 'snapshot' as const,
    currentTemp: 26,
    locationName: 'Toronto, Canada',
    historical: HISTORICAL,
    error: null,
    fetchedAt: null,
    isStale: false,
  };
}

beforeEach(() => {
  usePortfolioStore.setState({
    climate: readyClimate(),
    selectedClimateYear: 2024,
    mode: '2d',
    climatePanelOpen: false,
  });
  document.body.style.cursor = '';
});

describe('buildProjectorTexture (shared drawer, headless)', () => {
  it('returns null when no 2D context exists (graceful headless fallback)', () => {
    expect(
      buildProjectorTexture(SMALL_CELLS, 2024, 'TODAY', noContextFactory),
    ).toBeNull();
  });

  it('paints title, year, heatmap cells, today verdict and attribution', () => {
    const { factory, calls, canvas } = recordingFactory();
    const texture = buildProjectorTexture(
      SMALL_CELLS,
      2024,
      '26.0°C — 2.0°C HOTTER THAN USUAL',
      factory,
    );
    expect(texture).toBeInstanceOf(THREE.CanvasTexture);
    expect(texture!.image).toBe(canvas);
    expect(texture!.colorSpace).toBe(THREE.SRGBColorSpace);

    const text = calls
      .filter((call) => call.method === 'fillText')
      .map((call) => String(call.args[0]));
    expect(text).toContain('OUR CLIMATE, OUR FUTURE');
    expect(text.some((line) => line.includes('2024'))).toBe(true);
    expect(text).toContain('IS TODAY WEIRDLY HOT/COLD?');
    expect(text).toContain('26.0°C — 2.0°C HOTTER THAN USUAL');
    expect(text).toContain(CLIMATE_ATTRIBUTION_LINE);
    expect(text).toContain(
      `${CLIMATE_ATTRIBUTION.supportLabel} ${CLIMATE_ATTRIBUTION.climateDefenseFund.label}`,
    );
    // The heatmap drawing is nested in save/translate/restore by the projector.
    expect(calls.map((call) => call.method)).toContain('translate');
    expect(calls.map((call) => call.method)).toContain('save');
    expect(calls.map((call) => call.method)).toContain('restore');
  });

  it('paints a climate-LOCAL menu strip (year / back / info), not a global nav copy', () => {
    const a = recordingFactory();
    buildProjectorTexture(SMALL_CELLS, 2024, 'SAME', a.factory);
    const texts = a.calls
      .filter((call) => call.method === 'fillText')
      .map((call) => String(call.args[0]));
    for (const label of ['YEAR', 'BACK', 'INFO']) {
      expect(texts.some((text) => text.includes(label))).toBe(true);
    }
    for (const globalRoute of ['ABOUT', 'EXPERIENCE', 'PROJECTS']) {
      expect(texts.some((text) => text.includes(globalRoute))).toBe(false);
    }
  });

  it('is deterministic for identical inputs', () => {
    const a = recordingFactory();
    const b = recordingFactory();
    buildProjectorTexture(SMALL_CELLS, 2024, 'SAME', a.factory);
    buildProjectorTexture(SMALL_CELLS, 2024, 'SAME', b.factory);
    expect(b.calls).toEqual(a.calls);
  });
});

describe('ClimateProjector R3F zone (headless, structural)', () => {
  let materials: RoomMaterials;
  let screenGeometry: THREE.PlaneGeometry;

  beforeEach(() => {
    materials = createRoomMaterials({});
    screenGeometry = new THREE.PlaneGeometry(1.9, 1.07);
  });

  async function mount(
    factory: ClimateCanvasFactory = recordingFactory().factory,
  ) {
    return ReactThreeTestRenderer.create(
      <ClimateProjector
        screenGeometry={screenGeometry}
        materials={materials}
        canvasFactory={factory}
      />,
      { frameloop: 'never' },
    );
  }

  function screenMesh(renderer: Awaited<ReturnType<typeof mount>>): THREE.Mesh {
    return renderer.scene
      .findAll((node) => node.type === 'Mesh')
      .find(
        (node) => (node.instance as THREE.Mesh).geometry === screenGeometry,
      )!.instance as THREE.Mesh;
  }

  it('uses the shared heatmap CanvasTexture on the screen mesh', async () => {
    const renderer = await mount();
    const material = screenMesh(renderer).material as THREE.MeshBasicMaterial;
    expect(material.map).toBeInstanceOf(THREE.CanvasTexture);
    await renderer.unmount();
    disposeRoomMaterials(materials);
    screenGeometry.dispose();
  });

  it('exposes climate-local back / info hit planes (4b)', async () => {
    const renderer = await mount();
    for (const name of ['projected-back', 'projected-info']) {
      const node = renderer.scene.find((item) => item.props.name === name);
      expect(node, `${name} must exist`).toBeDefined();
    }
    const info = renderer.scene.find(
      (item) => item.props.name === 'projected-info',
    )!;
    act(() => info.props.onClick({ stopPropagation: vi.fn() }));
    expect(usePortfolioStore.getState().climatePanelOpen).toBe(true);
    const back = renderer.scene.find(
      (item) => item.props.name === 'projected-back',
    )!;
    act(() => back.props.onClick({ stopPropagation: vi.fn() }));
    expect(window.location.hash).toBe('#/');
    await renderer.unmount();
    disposeRoomMaterials(materials);
    screenGeometry.dispose();
  });

  it('year dial → store change → per-year texture cache (no repaint spike)', async () => {
    const { factory, calls } = recordingFactory();
    const renderer = await mount(factory);
    const firstTexture = (
      screenMesh(renderer).material as THREE.MeshBasicMaterial
    ).map as THREE.CanvasTexture;
    const disposeFirst = vi.spyOn(firstTexture, 'dispose');

    const next = renderer.scene.find(
      (node) => node.props.name === 'climate-year-next',
    )!;
    const stopPropagation = vi.fn();
    calls.length = 0;
    act(() => next.props.onClick({ stopPropagation }));

    // Years are newest-first [2025, 2024, 2023, 2020]; ▶ moves to 2025.
    expect(usePortfolioStore.getState().selectedClimateYear).toBe(2025);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    const secondTexture = (
      screenMesh(renderer).material as THREE.MeshBasicMaterial
    ).map as THREE.CanvasTexture;
    expect(secondTexture).not.toBe(firstTexture);
    // 3c P7: cached textures are NOT disposed on a dial switch.
    expect(disposeFirst).not.toHaveBeenCalled();
    expect(
      calls
        .filter((call) => call.method === 'fillText')
        .map((call) => String(call.args[0]))
        .some((line) => line.includes('2025')),
    ).toBe(true);

    // ◀ returns to 2024: the original CanvasTexture is reused (zero repaint).
    calls.length = 0;
    const prev = renderer.scene.find(
      (node) => node.props.name === 'climate-year-prev',
    )!;
    act(() => prev.props.onClick({ stopPropagation: vi.fn() }));
    expect(usePortfolioStore.getState().selectedClimateYear).toBe(2024);
    const again = (screenMesh(renderer).material as THREE.MeshBasicMaterial)
      .map as THREE.CanvasTexture;
    expect(again).toBe(firstTexture);
    expect(calls.filter((call) => call.method === 'fillText')).toHaveLength(0);

    // Unmount disposes every cached texture once.
    const disposeSecond = vi.spyOn(secondTexture, 'dispose');
    await renderer.unmount();
    expect(disposeFirst).toHaveBeenCalledTimes(1);
    expect(disposeSecond).toHaveBeenCalledTimes(1);
    disposeRoomMaterials(materials);
    screenGeometry.dispose();
  });

  it('defers the painted texture until the climate zone is entered', async () => {
    act(() => usePortfolioStore.setState({ activeZone: '/' }));
    const { factory } = recordingFactory();
    const renderer = await ReactThreeTestRenderer.create(
      <ClimateProjector
        screenGeometry={screenGeometry}
        materials={materials}
        canvasFactory={factory}
        deferUntilZone
      />,
      { frameloop: 'never' },
    );
    expect(screenMesh(renderer).material).toBe(materials.screenFabric);
    act(() => usePortfolioStore.setState({ activeZone: '/climate' }));
    expect(
      (screenMesh(renderer).material as THREE.MeshBasicMaterial).map,
    ).toBeInstanceOf(THREE.CanvasTexture);
    await renderer.unmount();
    act(() => usePortfolioStore.setState({ activeZone: '/' }));
    disposeRoomMaterials(materials);
    screenGeometry.dispose();
  });

  it('reconciles a stale stored year onto the newest year with data', async () => {
    // The store seeds the current year (2026), but the bundled snapshot ends
    // in 2025. While in OTHER 3D zones ClimateView is not mounted, so the
    // projector itself must reconcile or it paints an all-gray no-data grid.
    usePortfolioStore.setState({
      climate: readyClimate(),
      selectedClimateYear: 2026,
    });
    const { factory, calls } = recordingFactory();
    const renderer = await mount(factory);

    await waitFor(() =>
      expect(usePortfolioStore.getState().selectedClimateYear).toBe(2025),
    );
    expect(
      calls
        .filter((call) => call.method === 'fillText')
        .map((call) => String(call.args[0]))
        .some((line) => line.includes('2025')),
    ).toBe(true);

    await renderer.unmount();
    disposeRoomMaterials(materials);
    screenGeometry.dispose();
  });

  it('year-dial prev/next are no-ops at the dataset boundaries', async () => {
    const renderer = await mount();
    const next = renderer.scene.find(
      (node) => node.props.name === 'climate-year-next',
    )!;
    const prev = renderer.scene.find(
      (node) => node.props.name === 'climate-year-prev',
    )!;

    act(() => usePortfolioStore.setState({ selectedClimateYear: 2025 }));
    act(() => next.props.onClick({ stopPropagation: vi.fn() }));
    expect(usePortfolioStore.getState().selectedClimateYear).toBe(2025);

    act(() => usePortfolioStore.setState({ selectedClimateYear: 2020 }));
    act(() => prev.props.onClick({ stopPropagation: vi.fn() }));
    expect(usePortfolioStore.getState().selectedClimateYear).toBe(2020);

    await renderer.unmount();
    disposeRoomMaterials(materials);
    screenGeometry.dispose();
  });

  it('a 3D dial change is visible in the 2D year selector (shared store)', async () => {
    const renderer = await mount();
    const next = renderer.scene.find(
      (node) => node.props.name === 'climate-year-next',
    )!;
    act(() => next.props.onClick({ stopPropagation: vi.fn() }));
    expect(usePortfolioStore.getState().selectedClimateYear).toBe(2025);

    renderWithProviders(<ClimateView />);
    expect(screen.getByLabelText('Select Year')).toHaveValue('2025');

    await renderer.unmount();
    disposeRoomMaterials(materials);
    screenGeometry.dispose();
  });

  it('clicking the screen opens the DOM panel (stopping propagation)', async () => {
    const renderer = await mount();
    const screen = renderer.scene.find(
      (node) => node.props.name === 'projector-screen-texture',
    )!;
    const stopPropagation = vi.fn();
    act(() => screen.props.onClick({ stopPropagation }));
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(usePortfolioStore.getState().climatePanelOpen).toBe(true);
    await renderer.unmount();
    disposeRoomMaterials(materials);
    screenGeometry.dispose();
  });

  it('falls back to the room-owned screenFabric when no 2D context exists', async () => {
    const renderer = await mount(noContextFactory);
    const material = screenMesh(renderer).material;
    expect(material).toBe(materials.screenFabric);
    await renderer.unmount();
    disposeRoomMaterials(materials);
    screenGeometry.dispose();
  });
});

describe('ClimateProjectorPanel (accessible DOM equivalent)', () => {
  it('shows the same statement, widgets, selector, legend and links as 2D', () => {
    act(() =>
      usePortfolioStore.setState({ climatePanelOpen: true, mode: '3d' }),
    );
    renderWithProviders(<ClimateProjectorPanel />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // The dialog's accessible name comes from the Modal's `title` prop — a plain
    // string Mantine renders in its OWN <h2> (aria-labelledby target). The
    // shared ClimateView keeps its own <h2> title and <h3> widget headings as
    // valid siblings; none is nested inside the title.
    expect(dialog).toHaveAccessibleName(`${CLIMATE_TITLE} — Projector Feed`);
    expect(
      document.getElementById('projector-panel-climate-heading'),
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent(CLIMATE_STATEMENT);
    expect(
      within(dialog).getByRole('heading', {
        level: 3,
        name: 'Is Today Weirdly Hot/Cold?',
      }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Select Year')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Hottest day on record'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('img', { name: /Historical weather heatmap/ }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('link', { name: 'Open-Meteo.com' }),
    ).toHaveAttribute('href', CLIMATE_ATTRIBUTION.openMeteo.url);
    expect(
      within(dialog).getByRole('link', {
        name: 'Climate Defense Fund of Ontario',
      }),
    ).toHaveAttribute('href', CLIMATE_ATTRIBUTION.climateDefenseFund.url);
  });

  it('renders one valid h2 from the title prop (no <p> or nested heading)', () => {
    act(() =>
      usePortfolioStore.setState({ climatePanelOpen: true, mode: '3d' }),
    );
    renderWithProviders(<ClimateProjectorPanel />);
    const dialog = screen.getByRole('dialog');
    const title = `${CLIMATE_TITLE} — Projector Feed`;
    const titleHeadings = [...dialog.querySelectorAll('h2')].filter(
      (heading) => heading.textContent?.trim() === title,
    );
    expect(titleHeadings).toHaveLength(1);
    // p5-display styling survives via the Styles API `title` className.
    expect(titleHeadings[0]!.className).toContain('p5-display');
    expect(titleHeadings[0]!.className).toContain('text-p5-red');
    // A <p> passed as the title used to land inside Mantine's h2 — invalid
    // block-in-heading markup. The title h2 now holds plain text only.
    expect(titleHeadings[0]!.querySelector('p')).toBeNull();
    expect(
      dialog.querySelector(
        'h1 h1, h1 h2, h1 h3, h2 h1, h2 h2, h2 h3, h3 h1, h3 h2, h3 h3',
      ),
    ).toBeNull();
  });

  it('traps focus, closes on Esc and restores focus to the opener', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    act(() =>
      usePortfolioStore.setState({ climatePanelOpen: true, mode: '3d' }),
    );
    renderWithProviders(<ClimateProjectorPanel />);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement),
    );
    await userEvent.keyboard('{Escape}');
    expect(usePortfolioStore.getState().climatePanelOpen).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });

  it('closes from the close button', async () => {
    const user = userEvent.setup();
    act(() =>
      usePortfolioStore.setState({ climatePanelOpen: true, mode: '3d' }),
    );
    renderWithProviders(<ClimateProjectorPanel />);
    await user.click(
      screen.getByRole('button', { name: 'Close climate panel' }),
    );
    expect(usePortfolioStore.getState().climatePanelOpen).toBe(false);
  });

  it('closes on backdrop click', async () => {
    const user = userEvent.setup();
    act(() =>
      usePortfolioStore.setState({ climatePanelOpen: true, mode: '3d' }),
    );
    renderWithProviders(<ClimateProjectorPanel />);
    await user.click(
      document.querySelector(
        '.climate-projector-overlay .post-detail-backdrop',
      ) as HTMLElement,
    );
    expect(usePortfolioStore.getState().climatePanelOpen).toBe(false);
  });

  it('Escape defers to a sibling 3D modal instead of double-closing', async () => {
    act(() =>
      usePortfolioStore.setState({ climatePanelOpen: true, mode: '3d' }),
    );
    renderWithProviders(<ClimateProjectorPanel />);
    await screen.findByRole('dialog');

    // Inject a sibling overlay flag directly (the open actions would clear the
    // panel). Its Escape handler runs first; the panel must not also close.
    act(() => usePortfolioStore.setState({ selectedPostId: 'cidel' }));
    await userEvent.keyboard('{Escape}');
    expect(usePortfolioStore.getState().climatePanelOpen).toBe(true);

    act(() => usePortfolioStore.setState({ selectedPostId: null }));
    await userEvent.keyboard('{Escape}');
    expect(usePortfolioStore.getState().climatePanelOpen).toBe(false);
  });
});

describe('keyboard path in 3D + unchanged 2D route', () => {
  it('Tab/Enter on the projector trigger opens the dialog in 3D', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/climate';
    renderWithProviders(<App />); // mounts in 2D (jsdom has no WebGL2)
    act(() => usePortfolioStore.setState({ mode: '3d' }));

    const trigger = screen.getByRole('button', {
      name: 'Open projector info panel',
    });
    trigger.focus();
    expect(trigger).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(usePortfolioStore.getState().climatePanelOpen).toBe(true);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Leaving 3D clears the panel but keeps the shared year.
    act(() => usePortfolioStore.getState().setMode('2d'));
    expect(usePortfolioStore.getState().climatePanelOpen).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open projector info panel' }),
    ).not.toBeInTheDocument();
  });

  it('renders the full 2D /climate view with the shared year selector', async () => {
    act(() =>
      usePortfolioStore.setState({ mode: '2d', climatePanelOpen: false }),
    );
    renderWithProviders(<ClimateView />);
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Our Climate, Our Future',
      }),
    ).toBeInTheDocument();
    const select = screen.getByLabelText('Select Year');
    expect(select).toHaveValue('2024');
    expect(
      screen.getByRole('img', { name: /Historical weather heatmap/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open-Meteo.com' }),
    ).toBeInTheDocument();
  });
});
