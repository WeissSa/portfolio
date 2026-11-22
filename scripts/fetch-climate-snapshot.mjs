#!/usr/bin/env node
/**
 * Build-time climate snapshot (REWORK_PLAN §4.4).
 *
 * Fetches the Open-Meteo historical archive (daily temperature_2m_mean,
 * last 30 years, Toronto coordinates) and writes public/climate-snapshot.json.
 * The location/window come from the same climate-config.mjs the client uses,
 * so the bundled snapshot can never drift from the live query. The SPA uses
 * this file when the live API and the localStorage cache are both
 * unavailable. It runs once via `prebuild` (npm run build).
 */
import { readFile, writeFile } from 'node:fs/promises';
import {
  CLIMATE_FETCH_TIMEOUT_MS as FETCH_TIMEOUT_MS,
  CLIMATE_LATITUDE as LATITUDE,
  CLIMATE_LOCATION_NAME as NAME,
  CLIMATE_LONGITUDE as LONGITUDE,
  CLIMATE_YEARS_OF_HISTORY as YEARS_OF_HISTORY,
} from '../src/content/climate-config.mjs';

const OUT_FILE = 'public/climate-snapshot.json';
/**
 * An all-null (or almost empty) API response must never replace the good
 * committed fallback with a blank heatmap. ~30 years of daily data normally
 * yields thousands of records; require at least a month of them.
 */
const MIN_SNAPSHOT_RECORDS = 28;

const endDate = new Date();
const startDate = new Date(endDate);
startDate.setFullYear(startDate.getFullYear() - YEARS_OF_HISTORY);
const iso = (d) => d.toISOString().split('T')[0];

const url =
  `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUDE}` +
  `&longitude=${LONGITUDE}&start_date=${iso(startDate)}&end_date=${iso(endDate)}` +
  `&daily=temperature_2m_mean&temperature_unit=celsius&timezone=auto`;

/**
 * Refresh is best-effort: a transient Open-Meteo outage must never break a
 * build. On failure we keep the last-good committed snapshot in place and
 * emit a warning so CI logs still surface the problem.
 */
try {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Open-Meteo archive request failed: HTTP ${res.status}`);
  }
  const json = await res.json();
  const times = json?.daily?.time;
  const means = json?.daily?.temperature_2m_mean;
  if (!Array.isArray(times) || !Array.isArray(means) || times.length === 0) {
    throw new Error('Open-Meteo archive response missing daily data');
  }

  const flat = {};
  times.forEach((dateString, index) => {
    const value = means[index];
    if (typeof value === 'number' && Number.isFinite(value)) {
      flat[dateString] = Math.round(value * 10) / 10;
    }
  });

  // Best-effort guard: an outage can return every daily value as null. Even
  // though `times.length > 0`, that payload carries no usable data — bail out
  // so the last-good committed snapshot keeps serving the heatmap.
  if (Object.keys(flat).length < MIN_SNAPSHOT_RECORDS) {
    throw new Error(
      `Open-Meteo archive returned only ${Object.keys(flat).length} usable ` +
        `daily records (expected ≥ ${MIN_SNAPSHOT_RECORDS})`,
    );
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    location: { latitude: LATITUDE, longitude: LONGITUDE, name: NAME },
    flat,
  };

  // Snapshot-drift guard: only rewrite the file when the DATA actually
  // changed. `generatedAt` alone must not dirty the working tree on routine
  // builds; the committed snapshot stays byte-identical (and remains the
  // bundled fallback) unless Open-Meteo returns new/changed records.
  const dataOnly = (value) =>
    JSON.stringify({
      location: value?.location,
      flat: value?.flat,
    });
  let unchanged = false;
  try {
    const existing = JSON.parse(await readFile(OUT_FILE, 'utf8'));
    unchanged = dataOnly(existing) === dataOnly(snapshot);
  } catch {
    // Missing or corrupt snapshot file: fall through and write a fresh one.
  }

  if (unchanged) {
    console.log(
      `${OUT_FILE} data unchanged; keeping the committed snapshot as-is ` +
        `(generatedAt not bumped).`,
    );
  } else {
    await writeFile(OUT_FILE, JSON.stringify(snapshot));
    console.log(
      `refreshed ${OUT_FILE}: ${Object.keys(flat).length} daily records ` +
        `(${iso(startDate)} → ${iso(endDate)})`,
    );
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(
    `warning: climate snapshot refresh failed (${message}); ` +
      `keeping the existing ${OUT_FILE}.`,
  );
}
