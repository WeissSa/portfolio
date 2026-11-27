import { useSyncExternalStore } from 'react';

/**
 * Tiny hash router: `#/`, `#/about`, `#/experience`, `#/projects`,
 * `#/climate`. No dependencies, GitHub-Pages friendly (no server rewrites
 * needed; public/404.html maps legacy Next.js paths onto these routes).
 */

export const ROUTES = [
  '/',
  '/about',
  '/experience',
  '/projects',
  '/climate',
] as const;

export type Route = (typeof ROUTES)[number];

export const isRoute = (value: string): value is Route =>
  (ROUTES as readonly string[]).includes(value);

/** Parse a `location.hash` value into a known route; unknown → `/`. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return isRoute(normalized) ? normalized : '/';
}

export function getRoute(): Route {
  return parseRoute(window.location.hash);
}

export function navigate(route: Route): void {
  const hash = `#${route}`;
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener('hashchange', emit);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('hashchange', emit);
    }
  };
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** React hook returning the current hash route, re-rendering on change. */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getRoute, () => '/');
}
