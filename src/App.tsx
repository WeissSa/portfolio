import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, MantineProvider } from '@mantine/core';
import { mantineTheme } from './styles/mantine-theme';
import {
  canOptIntoReducedMotion3d,
  clearManualMode,
  detectCapabilities,
  recommendMode,
  resolveMode,
  writeSceneFailure,
  type DeviceTier,
} from './lib/device-tier';
import { usePrefersReducedMotion } from './lib/a11y';
import { useDiegeticDetail } from './lib/detail-mode';
import { useRoute, type Route } from './lib/router';
import { usePortfolioStore } from './state/store';
import { MainMenu } from './ui/MainMenu';
import { PointerMenuStrip } from './ui/PointerMenuStrip';
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
  const pointerFine = usePortfolioStore((s) => s.pointerFine);
  const sceneReady = usePortfolioStore((s) => s.sceneReady);
  const cameraSettled = usePortfolioStore((s) => s.cameraSettled);
  const closeAllDetails = usePortfolioStore((s) => s.closeAllDetails);
  /** True only when WebGL actually drew a frame — never a bare mode flag. */
  const sceneLive = mode === '3d' && sceneReady;
  // Monitor desktop zoom (commit 7): 3D-only. 2D #/about keeps rendering
  // AboutDesktop through ZoneContent below, unaffected by this flag.
  const desktopOpen = usePortfolioStore((s) => s.desktopOpen);
  // Climate projector dialog (commit 9): a 3D-only DOM panel opened by the
  // screen pick or by the keyboard-accessible trigger below.
  const climatePanelOpen = usePortfolioStore((s) => s.climatePanelOpen);
  const openClimatePanel = usePortfolioStore((s) => s.openClimatePanel);
  const selectedPostId = usePortfolioStore((s) => s.selectedPostId);
  const selectedProjectId = usePortfolioStore((s) => s.selectedProjectId);
  /**
   * ONE surface per content: while any detail panel owns the screen, the zone
   * list behind it is unmounted. Otherwise the same post/climate body renders
   * twice (expanded in the panel and again in the zone column), which is both a
   * reading hazard and a second competing scroll container.
   */
  const detailOpen = Boolean(
    selectedPostId ||
      selectedProjectId ||
      (mode === '3d' && (desktopOpen || climatePanelOpen)),
  );
  const reducedMotionOptIn = usePortfolioStore((s) => s.reducedMotionOptIn);
  const setReducedMotionOptInAvailable = usePortfolioStore(
    (s) => s.setReducedMotionOptInAvailable,
  );
  const prefersReducedMotion = usePrefersReducedMotion();
  /** 3D while reduced motion is active: static cuts + HUD + frozen grain. */
  const static3d = sceneLive && prefersReducedMotion;
  /** Fine-pointer live 3D only: detail lives in-world, DOM is an a11y mirror. */
  const diegeticDetail = useDiegeticDetail();
  const initialRouteSynced = useRef(false);
  // MAJOR 8: DOM content follows the camera, not the hash. In live 3D the
  // column only swaps once the flight settles; in 2D/fallback it swaps at once.
  const [displayRoute, setDisplayRoute] = useState<Route>(route);
  const [tier, setTier] = useState<DeviceTier>('desktop');
  // 3c P10 warm start: after the first 3D visit, DESKTOP keeps the Canvas
  // mounted (frameloop='never' + hidden) so a 2D↔3D toggle costs no WebGL
  // context/render-target rebuild. Mobile/low deliberately unmount: GPU memory
  // matters more than one toggle there, and their tier can change on rotation.
  const [sceneVisited, setSceneVisited] = useState(false);
  /** Transient "no scene" signal (not the sticky crash flag). */
  const [sceneUnavailable, setSceneUnavailable] = useState(false);
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
    setSceneUnavailable(true);
  }, [setAutoMode, setMode]);

  // A Canvas that mounts but never issues a frame (dev context failure, lazy
  // chunk stall) must not leave the visitor in a half-3D shell. Fall back to
  // clean full-width 2D after a generous grace period, WITHOUT writing the
  // sticky crash flag (a slow first compile must not permanently disable 3D).
  useEffect(() => {
    if (mode !== '3d' || sceneReady) {
      if (mode === '3d') setSceneUnavailable(false);
      return;
    }
    const timer = setTimeout(() => {
      if (!usePortfolioStore.getState().sceneReady) {
        setSceneUnavailable(true);
        setMode('2d');
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, [mode, sceneReady, setMode]);

  useEffect(() => {
    if (!initialRouteSynced.current) {
      // First paint: adopt whatever route we landed on (including legacy
      // deep-link redirects) without dropping `app-initial` / playing cut-in.
      initialRouteSynced.current = true;
      syncInitialRoute(route);
      return;
    }
    // Navigation always wins over a detail close-up: clear the open panel
    // BEFORE the camera recomputes its viewpoint, otherwise `detail` keeps
    // overriding the destination zone (HOME could change the hash but never
    // fly home). This also covers browser Back/Forward and deep links.
    closeAllDetails();
    setActiveZone(route);
  }, [route, setActiveZone, syncInitialRoute, closeAllDetails]);

  useEffect(() => {
    // Read the live settle flag from the store: the route effect above has
    // already flipped it to false in the same commit, so a closure value would
    // be stale and swap the column one frame early (the old desync bug).
    const state = usePortfolioStore.getState();
    const live = state.mode === '3d' && state.sceneReady;
    if (!live || state.cameraSettled) setDisplayRoute(route);
    // cameraSettled/sceneLive are deliberately dependencies so the settled
    // flight commits the pending zone; the read above stays authoritative.
  }, [route, cameraSettled, sceneLive]);

  // Device-tier gate runs AFTER the 2D shell has painted (§4.5): the store
  // starts in 2D, capable devices opt into 3D, conservative devices stay 2D.
  // Runs once; later toggles are driven only by ModeToggle's manual override.
  useEffect(() => {
    const caps = detectCapabilities();
    const decision = resolveMode(caps);
    const optInAvailable = canOptIntoReducedMotion3d(caps, decision.tier);
    setReducedMotionOptInAvailable(optInAvailable);
    setTier(decision.tier);
    // Reduced motion stays authoritative for AUTO mode; only the explicit,
    // informed opt-in (ModeToggle) may put this session into 3D.
    setMode(
      optInAvailable &&
        reducedMotionOptIn &&
        decision.reason === 'reduced-motion'
        ? '3d'
        : decision.mode,
    );
    // The toggle uses the ungated recommendation to decide whether 3D is even
    // offered and to restore "Auto" after a manual override is cleared.
    setAutoMode(recommendMode(caps));
    // Canvas picking is enabled only for a fine pointer; keyboard/assistive
    // users always have the DOM equivalent (§3.3, commit 6).
    setPointerFine(caps.pointerType === 'fine');
  }, [
    setMode,
    setAutoMode,
    setPointerFine,
    setReducedMotionOptInAvailable,
    reducedMotionOptIn,
  ]);

  return (
    <MantineProvider theme={mantineTheme} forceColorScheme="dark">
      <div
        className={`min-h-screen bg-p5-black text-white${
          hasNavigated ? '' : ' app-initial'
        }${mode === '3d' ? ' app-3d' : ''}${
          pointerFine ? ' app-fine-pointer' : ''
        }${static3d ? ' app-static-3d' : ''}${
          sceneLive ? ' app-scene-live' : ''
        }${detailOpen ? ' app-detail-open' : ''}`}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-p5-yellow focus:px-4 focus:py-2 focus:font-bold focus:text-p5-black"
        >
          Skip to content
        </a>

        {sceneUnavailable && mode === '2d' && (
          <p className="scene-unavailable-notice" role="status">
            3D unavailable — showing 2D
          </p>
        )}

        {/* Zone changes announced to screen readers (plan §3.3). */}
        <p aria-live="polite" className="sr-only">
          {ZONE_NAMES[route]} selected
        </p>

        {/* Reduced-motion 3D opt-in: no camera flights, so the visible ZONE
            HUD is the substitute for motion as a navigation cue (commit 4). */}
        {static3d && (
          <div className="zone-title-hud" aria-hidden="true">
            <span className="p5-display">{ZONE_NAMES[route]}</span>
            <span className="zone-title-hud__note">static view</span>
          </div>
        )}

        {/* 3c warm start: desktop keeps the lazy Canvas mounted after the first
          visit (hidden + zero frames while in 2D); mobile/low unmount as before.
          The boundary keeps a Canvas-creation failure from unmounting the root. */}
        {sceneMounted && (
          <SceneErrorBoundary onError={handleSceneError}>
            <SceneLayer quality={tier} active={mode === '3d'} />
          </SceneErrorBoundary>
        )}

        {/* Discoverable pointer menu for the in-world room. Outside .app-shell
            so it survives the inert shell of an open detail dialog, and above
            the detail scrim so HOME works during a close-up. */}
        {diegeticDetail && <PointerMenuStrip />}

        {/* polish(c) F2: in-world detail is picked on an aria-hidden canvas, so
            every 3D pick focuses this sr-only DOM proxy of the trigger; closing
            a detail mirror restores focus here. Absent in fallback modes.
            POLISH(C) FIX: the proxy MUST precede the overlays in DOM order so a
            natural forward Tab from it lands inside the open a11y mirror (the
            old trailing position required a 40× Shift+Tab wrap-around hack). */}
        {diegeticDetail && (
          <button
            id="detail-return"
            type="button"
            tabIndex={-1}
            aria-label="Return to the 3D room"
            className="sr-only"
          />
        )}

        {/* Shared DOM detail overlay for a picked 3D book (renders null when no
          book is selected). Content lives here, never inside the canvas. */}
        <PostDetailOverlay />

        {/* Shared DOM detail dialog for a picked 3D game case (renders null when
          no case is selected). Like the book overlay it sits outside the shell
          so 3D pointer gating never disables its links/buttons. */}
        <ProjectDetailOverlay />

        {/* Monitor zoom: full-screen DOM About desktop, shared with 2D mode.
          Only in 3D — a stale flag can never double-render the 2D About zone.
          In fine-pointer live 3D it renders as the visually-hidden a11y mirror. */}
        {mode === '3d' && desktopOpen && <DesktopZoom />}

        {/* Climate projector dialog: the same ClimateView as the 2D route, in a
          focus-managed panel on top of the canvas (every fact reachable in DOM).
          A11y mirror in fine-pointer live 3D; visible in every fallback mode. */}
        {mode === '3d' && climatePanelOpen && <ClimateProjectorPanel />}

        <div className="app-shell mx-auto flex max-w-7xl flex-col gap-4 p-3 md:flex-row md:p-6">
          <div className="md:w-64 md:shrink-0">
            <MainMenu />
          </div>
          <main id="main" className="min-w-0 flex-1">
            {/* The zone list is unmounted while a detail panel is open — the
              panel is the only visible copy of that content. Reappears on close. */}
            {!detailOpen && (
              <>
                {/* Keyboard/SR equivalent of picking the 3D projector screen.
                    Only rendered in 3D; the 2D #/climate route is untouched. */}
                {mode === '3d' && displayRoute === '/climate' && (
                  <Button
                    type="button"
                    onClick={openClimatePanel}
                    aria-haspopup="dialog"
                    className="p5-btn p5-btn--red mb-3 min-h-[44px] px-4 font-bold"
                  >
                    View climate details
                  </Button>
                )}
                <ZoneContent
                  route={displayRoute}
                  suppressAbout={mode === '3d' && desktopOpen}
                />
              </>
            )}
          </main>
        </div>
      </div>
    </MantineProvider>
  );
}
