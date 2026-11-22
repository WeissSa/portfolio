/**
 * Single source of truth for the climate location and history window.
 *
 * Shared by the client (src/content/climate.ts, src/lib/climate.ts) and the
 * build-time snapshot script (scripts/fetch-climate-snapshot.mjs) so the
 * bundled snapshot and the live client always query the same place/window.
 *
 * Kept as `.mjs` (not `.ts`) so Node 21 can import it without a transpiler;
 * the sibling `.d.mts` gives TypeScript the same constants.
 */
export const CLIMATE_LATITUDE = 43.6532;
export const CLIMATE_LONGITUDE = -79.3832;
export const CLIMATE_LOCATION_NAME = 'Toronto, Canada';
export const CLIMATE_YEARS_OF_HISTORY = 30;
