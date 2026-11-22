import { createRef, useCallback, useMemo, type KeyboardEvent } from 'react';
import { LINKS } from '../content/links';
import { HEADLINE, SITE_OWNER } from '../content/bio';
import { Route, ROUTES, useRoute } from '../lib/router';
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
    <nav aria-label="Main menu" className="p5-cut-in">
      <div className="p5-panel p5-panel--red mb-2 px-4 py-3">
        <p className="p5-display text-lg leading-tight text-p5-black">
          {SITE_OWNER}
        </p>
        <p className="text-xs font-bold text-p5-black">{HEADLINE}</p>
      </div>
      <ul className="flex flex-row gap-2 overflow-x-auto md:flex-col md:overflow-visible">
        {ROUTES.map((r, index) => (
          <li key={r} className="shrink-0 md:shrink">
            <a
              ref={itemRefs[index]}
              data-index={index}
              href={`#${r}`}
              onKeyDown={onKeyDown}
              aria-current={route === r ? 'page' : undefined}
              className={`p5-btn w-full justify-start text-base ${
                route === r ? 'p5-btn--active' : ''
              }`}
            >
              <span>{MENU_LABELS[r]}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-2 md:mt-6">
        <ModeToggle />
        <a
          href={LINKS.github.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub (opens in a new tab)"
          className="p5-btn p5-btn--red px-3"
        >
          <GitHubIcon />
        </a>
        <a
          href={LINKS.linkedin.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LinkedIn (opens in a new tab)"
          className="p5-btn p5-btn--red px-3"
        >
          <LinkedInIcon />
        </a>
      </div>
    </nav>
  );
}
