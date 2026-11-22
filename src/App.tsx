import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearManualMode,
  detectCapabilities,
  recommendMode,
  resolveMode,
  type DeviceTier,
} from './lib/device-tier';
import { useRoute, type Route } from './lib/router';
import { usePortfolioStore } from './state/store';
import { MainMenu } from './ui/MainMenu';
import { SceneLayer } from './ui/SceneLayer';
import { SceneErrorBoundary } from './ui/SceneErrorBoundary';
import { HomeSplash } from './ui/HomeSplash';
import { AboutDesktop } from './ui/AboutDesktop';
import { ExperienceView } from './ui/ExperienceView';
import { PostDetailOverlay } from './ui/PostDetailOverlay';
import { ProjectsView } from './ui/ProjectsView';
import { ClimateView } from './ui/ClimateView';

const ZONE_NAMES: Record<Route, string> = {
  '/': 'Home',
  '/about': 'About',
  '/experience': 'Experience',
  '/projects': 'Projects',
  '/climate': 'Climate',
};

function ZoneContent({ route }: { route: Route }) {
  switch (route) {
    case '/about':
      return <AboutDesktop />;
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
  const initialRouteSynced = useRef(false);
  const [tier, setTier] = useState<DeviceTier>('desktop');

  // If the optional 3D layer ever throws, contain it: force the authoritative
  // 2D shell and clear the override so the crash cannot repeat on reload.
  const handleSceneError = useCallback(() => {
    clearManualMode();
    setMode('2d');
  }, [setMode]);

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

      {/* Mounted ONLY in 3D. The lazy import never blocks the 2D shell above,
          and unmounting here tears down every GPU resource via Room's cleanup.
          The boundary keeps a Canvas-creation failure from unmounting the root. */}
      {mode === '3d' && (
        <SceneErrorBoundary onError={handleSceneError}>
          <SceneLayer quality={tier} />
        </SceneErrorBoundary>
      )}

      {/* Shared DOM detail overlay for a picked 3D book (renders null when no
          book is selected). Content lives here, never inside the canvas. */}
      <PostDetailOverlay />

      <div className="app-shell mx-auto flex max-w-7xl flex-col gap-4 p-3 md:flex-row md:p-6">
        <div className="md:w-64 md:shrink-0">
          <MainMenu />
        </div>
        <main id="main" className="min-w-0 flex-1">
          <ZoneContent route={route} />
        </main>
      </div>
    </div>
  );
}
