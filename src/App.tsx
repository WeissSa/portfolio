import { useEffect, useRef } from 'react';
import { useRoute, type Route } from './lib/router';
import { usePortfolioStore } from './state/store';
import { MainMenu } from './ui/MainMenu';
import { HomeSplash } from './ui/HomeSplash';
import { AboutDesktop } from './ui/AboutDesktop';
import { ExperienceView } from './ui/ExperienceView';
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
 * 2D P5 shell (REWORK_PLAN commit 3): menu + hash-routed zones, aria-live
 * zone announcements, skip link. 3D mode streams in with later commits;
 * this experience is complete without it.
 */
export default function App() {
  const route = useRoute();
  const setActiveZone = usePortfolioStore((s) => s.setActiveZone);
  const syncInitialRoute = usePortfolioStore((s) => s.syncInitialRoute);
  const hasNavigated = usePortfolioStore((s) => s.hasNavigated);
  const initialRouteSynced = useRef(false);

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

  return (
    <div
      className={`min-h-screen bg-p5-black text-white${
        hasNavigated ? '' : ' app-initial'
      }`}
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

      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-3 md:flex-row md:p-6">
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
