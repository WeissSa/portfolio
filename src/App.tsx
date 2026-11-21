import { Route, ROUTES, navigate, useRoute } from './lib/router';

const ROUTE_LABELS: Record<Route, string> = {
  '/': 'Home',
  '/about': 'About',
  '/experience': 'Experience',
  '/projects': 'Projects',
  '/climate': 'Climate',
};

/**
 * Commit-1 skeleton shell: proves the Vite SPA + hash router boot at
 * base /portfolio/. The full P5 2D experience lands in commit 3.
 */
export default function App() {
  const route = useRoute();

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:text-black"
      >
        Skip to content
      </a>
      <header className="border-b border-neutral-800 px-4 py-3">
        <h1 className="text-xl font-bold">Sam Weiss</h1>
        <p className="text-sm text-neutral-300">
          SWE @ Gusto | HBSc in CS from UofT
        </p>
      </header>
      <nav aria-label="Main" className="flex gap-2 px-4 py-3">
        {ROUTES.map((r) => (
          <a
            key={r}
            href={`#${r}`}
            aria-current={route === r ? 'page' : undefined}
            className="min-h-[44px] rounded border border-neutral-700 px-3 py-2 text-sm hover:border-white"
          >
            {ROUTE_LABELS[r]}
          </a>
        ))}
      </nav>
      <main id="main" className="px-4 py-6">
        <h2 className="text-lg font-semibold">{ROUTE_LABELS[route]}</h2>
        <p className="mt-2 text-neutral-300">
          This section is part of the portfolio rework in progress.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 min-h-[44px] border border-neutral-700 px-4 py-2 text-sm hover:border-white"
        >
          Back home
        </button>
      </main>
    </div>
  );
}
