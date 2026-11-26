/**
 * Pointer-visible diegetic control strip (UX fix pass, MAJOR 4).
 *
 * The semantic <nav> is sr-only in fine-pointer live 3D and only reveals on
 * genuine keyboard focus — a mouse click can never do that, so pointer users
 * previously had no menu at all. This brass strip is a SECOND, purely visual
 * affordance: aria-hidden and out of the tab order (the single real <nav>
 * remains the accessible path), rendered by App outside `.app-shell` so a
 * modal detail dialog's inert shell can never disable it. Clicking any route
 * first closes every detail/modal — HOME therefore wins even during a
 * detail close-up.
 */
import { ROUTES, useRoute, type Route } from '../lib/router';
import { navigateAndCloseDetail } from '../lib/navigation';
import { usePortfolioStore } from '../state/store';

const LABELS: Record<Route, string> = {
  '/': 'Home',
  '/about': 'About',
  '/experience': 'Experience',
  '/projects': 'Projects',
  '/climate': 'Climate',
};

export function PointerMenuStrip() {
  const route = useRoute();
  const menuHoverRoute = usePortfolioStore((state) => state.menuHoverRoute);
  const menuFocusRoute = usePortfolioStore((state) => state.menuFocusRoute);

  return (
    <div className="pointer-menu-strip" aria-hidden="true">
      <p className="pointer-menu-strip__label">Sam Weiss — room menu</p>
      {ROUTES.map((r) => (
        <button
          key={r}
          type="button"
          tabIndex={-1}
          data-pointer-route={r}
          onClick={() => navigateAndCloseDetail(r)}
          className={`p5-btn pointer-menu-strip__btn${
            route === r ? ' p5-btn--active' : ''
          }${
            menuHoverRoute === r || menuFocusRoute === r
              ? ' p5-btn--diegetic-highlight'
              : ''
          }`}
        >
          {LABELS[r]}
        </button>
      ))}
    </div>
  );
}
