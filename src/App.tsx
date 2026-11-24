import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, MantineProvider } from '@mantine/core';
import { mantineTheme } from './styles/mantine-theme';
import {
  clearManualMode,
  detectCapabilities,
  recommendMode,
  resolveMode,
  writeSceneFailure,
  type DeviceTier,
} from './lib/device-tier';
import { useRoute, type Route } from './lib/router';
import { usePortfolioStore } from './state/store';
import { MainMenu } from './ui/MainMenu';
import { SceneLayer } from './ui/SceneLayer';
import { SceneErrorBoundary } from './ui/SceneErrorBoundary';
import { HomeSplash } from './ui/HomeSplash';
import { AboutDesktop } from './ui/AboutDesktop';
import { DesktopZoom } from './ui/DesktopZoom';
import { ExperienceView } from './ui/ExperienceView';
import { PostDetailOverlay } from './ui/PostDetailOverlay';
import { ProjectDetailOverlay } from './ui/ProjectDetailOverlay';
import { ProjectsView } from './ui/ProjectsView';
import { ClimateView } from './ui/ClimateView';
import { ClimateProjectorPanel } from './ui/ClimateProjectorPanel';

const ZONE_NAMES: Record<Route, string> = {
  '/': 'Home',
  '/about': 'About',
  '/experience': 'Experience',
  '/projects': 'Projects',
  '/climate': 'Climate',
};

function ZoneContent({
  route,
  suppressAbout,
}: {
  route: Route;
  /** The 3D monitor zoom renders its own AboutDesktop — never render two. */
  suppressAbout?: boolean;
}) {
  switch (route) {
    case '/about':
      return suppressAbout ? null : <AboutDesktop />;
    case '/experience':
      return <ExperienceView />;
    case '/projects':
      return <ProjectsView />;
    case '/climate':
      return <ClimateView />;
    case '/':
    default:
      return <HomeSplash />;
  }
}

/**
 * 2D P5 shell (REWORK_PLAN commit 3) with the lazy 3D room layered behind it.
 * The DOM menu, hash-routed zones, aria-live announcements and skip link are
 * always authoritative: 3D is an optional enhancement behind capability gates,
 * an error boundary and the mode selector's "Auto" recovery — the experience is
 * complete in 2D and stays usable if the Canvas cannot be created.
 */
export default function App() {
  const route = useRoute();
  const setActiveZone = usePortfolioStore((s) => s.setActiveZone);
  const syncInitialRoute = usePortfolioStore((s) => s.syncInitialRoute);
  const hasNavigated = usePortfolioStore((s) => s.hasNavigated);
  const mode = usePortfolioStore((s) => s.mode);
  const setMode = usePortfolioStore((s) => s.setMode);
  const setAutoMode = usePortfolioStore((s) => s.setAutoMode);
  const setPointerFine = usePortfolioStore((s) => s.setPointerFine);
  // Monitor desktop zoom (commit 7): 3D-only. 2D #/about keeps rendering
  // AboutDesktop through ZoneContent below, unaffected by this flag.
  const desktopOpen = usePortfolioStore((s) => s.desktopOpen);
  // Climate projector dialog (commit 9): a 3D-only DOM panel opened by the
  // screen pick or by the keyboard-accessible trigger below.
  const climatePanelOpen = usePortfolioStore((s) => s.climatePanelOpen);
  const openClimatePanel = usePortfolioStore((s) => s.openClimatePanel);
  const initialRouteSynced = useRef(false);
  const [tier, setTier] = useState<DeviceTier>('desktop');
  // 3c P10 warm start: after the first 3D visit, DESKTOP keeps the Canvas
  // mounted (frameloop='never' + hidden) so a 2D↔3D toggle costs no WebGL
  // context/render-target rebuild. Mobile/low deliberately unmount: GPU memory
  // matters more than one toggle there, and their tier can change on rotation.
  const [sceneVisited, setSceneVisited] = useState(false);
  useEffect(() => {
    if (mode === '3d') setSceneVisited(true);
  }, [mode]);
  const sceneMounted = mode === '3d' || (sceneVisited && tier === 'desktop');

  // If the optional 3D layer ever throws, contain it: force the authoritative
  // 2D shell, clear the manual override AND persist a failure signal, so neither
  // "Auto" nor a reload can re-arm a Canvas this device cannot create.
  const handleSceneError = useCallback(() => {
    writeSceneFailure();
    clearManualMode();
    setAutoMode('2d');
    setMode('2d');
  }, [setAutoMode, setMode]);

  useEffect(() => {
    if (!initialRouteSynced.current) {
      // First paint: adopt whatever route we landed on (including legacy
      // deep-link redirects) without dropping `app-initial` / playing cut-in.
      initialRouteSynced.current = true;
      syncInitialRoute(route);
      return;
    }
    setActiveZone(route);
  }, [route, setActiveZone, syncInitialRoute]);

  // Device-tier gate runs AFTER the 2D shell has painted (§4.5): the store
  // starts in 2D, capable devices opt into 3D, conservative devices stay 2D.
  // Runs once; later toggles are driven only by ModeToggle's manual override.
  useEffect(() => {
    const caps = detectCapabilities();
    const decision = resolveMode(caps);
    setTier(decision.tier);
    setMode(decision.mode);
    // The toggle uses the ungated recommendation to decide whether 3D is even
    // offered and to restore "Auto" after a manual override is cleared.
    setAutoMode(recommendMode(caps));
    // Canvas picking is enabled only for a fine pointer; keyboard/assistive
    // users always have the DOM equivalent (§3.3, commit 6).
    setPointerFine(caps.pointerType === 'fine');
  }, [setMode, setAutoMode, setPointerFine]);

  return (
    <MantineProvider theme={mantineTheme} forceColorScheme="dark">
      <div
        className={`min-h-screen bg-p5-black text-white${
          hasNavigated ? '' : ' app-initial'
        }${mode === '3d' ? ' app-3d' : ''}`}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-p5-yellow focus:px-4 focus:py-2 focus:font-bold focus:text-p5-black"
        >
          Skip to content
        </a>

        {/* Zone changes announced to screen readers (plan §3.3). */}
        <p aria-live="polite" className="sr-only">
          {ZONE_NAMES[route]} zone selected
        </p>

        {/* 3c warm start: desktop keeps the lazy Canvas mounted after the first
          visit (hidden + zero frames while in 2D); mobile/low unmount as before.
          The boundary keeps a Canvas-creation failure from unmounting the root. */}
        {sceneMounted && (
          <SceneErrorBoundary onError={handleSceneError}>
            <SceneLayer quality={tier} active={mode === '3d'} />
          </SceneErrorBoundary>
        )}

        {/* Shared DOM detail overlay for a picked 3D book (renders null when no
          book is selected). Content lives here, never inside the canvas. */}
        <PostDetailOverlay />

        {/* Shared DOM detail dialog for a picked 3D game case (renders null when
          no case is selected). Like the book overlay it sits outside the shell
          so 3D pointer gating never disables its links/buttons. */}
        <ProjectDetailOverlay />

        {/* Monitor zoom: full-screen DOM About desktop, shared with 2D mode.
          Only in 3D — a stale flag can never double-render the 2D About zone. */}
        {mode === '3d' && desktopOpen && <DesktopZoom />}

        {/* Climate projector dialog: the same ClimateView as the 2D route, in a
          focus-managed panel on top of the canvas (every fact reachable in DOM). */}
        {mode === '3d' && climatePanelOpen && <ClimateProjectorPanel />}

        <div className="app-shell mx-auto flex max-w-7xl flex-col gap-4 p-3 md:flex-row md:p-6">
          <div className="md:w-64 md:shrink-0">
            <MainMenu />
          </div>
          <main id="main" className="min-w-0 flex-1">
            {/* Keyboard/SR equivalent of picking the 3D projector screen (§3.3).
              Only rendered in 3D; the 2D #/climate route is untouched. */}
            {mode === '3d' && route === '/climate' && (
              <Button
                type="button"
                onClick={openClimatePanel}
                aria-haspopup="dialog"
                className="p5-btn p5-btn--red mb-3 min-h-[44px] px-4 font-bold"
              >
                Open projector info panel
              </Button>
            )}
            <ZoneContent
              route={route}
              suppressAbout={mode === '3d' && desktopOpen}
            />
          </main>
        </div>
      </div>
    </MantineProvider>
  );
}
