import { createRef, useCallback, useMemo, type KeyboardEvent } from 'react';
import { ActionIcon, Button, Tooltip } from '@mantine/core';
import { LINKS } from '../content/links';
import { HEADLINE, SITE_OWNER } from '../content/bio';
import { UI_COPY } from '../content/ui-copy';
import { Route, ROUTES, useRoute } from '../lib/router';
import { usePortfolioStore } from '../state/store';
import { GitHubIcon, LinkedInIcon } from './primitives';
import { ModeToggle } from './ModeToggle';

const MENU_LABELS: Record<Route, string> = {
  '/': 'Home',
  '/about': 'About',
  '/experience': 'Experience',
  '/projects': 'Projects',
  '/climate': 'Climate',
};

/**
 * P5 main menu (REWORK_PLAN §3.3): jagged slashed panels, skewed display
 * type, contact icons in the footer. Full keyboard support — Tab works
 * natively on the links; Arrow/Home/End provide roving focus; Enter follows
 * the hash link.
 */
export function MainMenu() {
  const route = useRoute();
  // Bidirectional diegetic sync (commit 4): DOM focus lights the plaque row;
  // plaque hover lights this DOM twin. Both use ONE canonical store field.
  const menuHoverRoute = usePortfolioStore((state) => state.menuHoverRoute);
  const menuFocusRoute = usePortfolioStore((state) => state.menuFocusRoute);
  const setMenuFocusRoute = usePortfolioStore(
    (state) => state.setMenuFocusRoute,
  );
  const itemRefs = useMemo(
    () => ROUTES.map(() => createRef<HTMLAnchorElement>()),
    [],
  );

  const focusItem = useCallback(
    (index: number) => {
      const clamped = ((index % ROUTES.length) + ROUTES.length) % ROUTES.length;
      itemRefs[clamped]?.current?.focus();
    },
    [itemRefs],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const current = Number(
      (event.currentTarget as HTMLElement).dataset.index ?? 0,
    );
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        focusItem(current + 1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        focusItem(current - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        focusItem(ROUTES.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <nav aria-label={UI_COPY.mainMenu} className="main-menu p5-cut-in">
      {/* Reveal-on-focus: in 3D desktop the nav is sr-only, but focusing any
          link un-hides this chip + the real links, so sighted keyboard users
          ALWAYS see where focus landed. */}
      <p className="main-menu__focus-chip" aria-hidden="true">
        {UI_COPY.menuFocusChip}
      </p>
      <div className="p5-panel p5-panel--red mb-2 px-4 py-3">
        <p className="p5-display text-lg leading-tight text-p5-black">
          {SITE_OWNER}
        </p>
        <p className="text-xs font-bold text-p5-black">{HEADLINE}</p>
      </div>
      {/* Mobile used to be a single non-wrapping row: at 390px only three
          routes were reachable and there was no scroll affordance. Wrap all
          five 44px targets onto two rows instead. */}
      <ul className="flex flex-wrap gap-2 md:flex-col">
        {ROUTES.map((r, index) => (
          <li key={r} className="shrink-0 md:shrink">
            <Button
              component="a"
              ref={itemRefs[index]}
              data-index={index}
              data-route={r}
              href={`#${r}`}
              // Same hash (e.g. HOME while already on '#/' with a detail
              // open) fires no hashchange, so clear the detail here too.
              onClick={() => usePortfolioStore.getState().closeDetail()}
              onKeyDown={onKeyDown}
              onFocus={() => setMenuFocusRoute(r)}
              onBlur={() => setMenuFocusRoute(null)}
              aria-current={route === r ? 'page' : undefined}
              radius={0}
              className={`p5-btn w-full justify-start text-base ${
                route === r ? 'p5-btn--active' : ''
              }${
                menuHoverRoute === r || menuFocusRoute === r
                  ? ' p5-btn--diegetic-highlight'
                  : ''
              }`}
            >
              <span>{MENU_LABELS[r]}</span>
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-2 md:mt-6">
        <ModeToggle />
        <Tooltip label="GitHub" withArrow>
          <ActionIcon
            component="a"
            href={LINKS.github.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub (opens in a new tab)"
            radius={0}
            className="p5-btn p5-btn--red px-3"
          >
            <GitHubIcon />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="LinkedIn" withArrow>
          <ActionIcon
            component="a"
            href={LINKS.linkedin.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn (opens in a new tab)"
            radius={0}
            className="p5-btn p5-btn--red px-3"
          >
            <LinkedInIcon />
          </ActionIcon>
        </Tooltip>
      </div>
    </nav>
  );
}
