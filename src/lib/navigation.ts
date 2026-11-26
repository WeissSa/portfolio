/**
 * Route helper used by every in-world and DOM navigation control.
 *
 * `navigate()` on its own only writes the hash. When a detail panel is open
 * the camera close-up (`detail`) used to take precedence over the destination
 * zone, so HOME could change the DOM hash without ever flying home. Closing
 * all detail state FIRST makes zone navigation win unconditionally — including
 * the case where the visitor is already on `#/` and clicks the HOME badge (no
 * hashchange event would fire to clear it).
 */
import { usePortfolioStore } from '../state/store';
import { navigate, type Route } from './router';

export function navigateAndCloseDetail(route: Route): void {
  usePortfolioStore.getState().closeAllDetails();
  navigate(route);
}
