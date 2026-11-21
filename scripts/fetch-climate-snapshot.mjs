#!/usr/bin/env node
/**
 * Build-time climate snapshot (REWORK_PLAN §4.4).
 *
 * Fetches the Open-Meteo historical archive (daily temperature_2m_mean,
 * last 30 years, Toronto coordinates identical to src/content/climate.ts)
 * and writes public/climate-snapshot.json. The SPA uses this file as the
 * bundled fallback when the live API and the localStorage cache are both
 * unavailable. CI can re-run this at build time to refresh the snapshot:
 *
 *   node scripts/fetch-climate-snapshot.mjs
 */
import { writeFile } from 'node:fs/promises';

const LATITUDE = 43.6532;
const LONGITUDE = -79.3832;
const NAME = 'Toronto, Canada';
const YEARS_OF_HISTORY = 30;
const OUT_FILE = 'public/climate-snapshot.json';

const endDate = new Date();
const startDate = new Date(endDate);
startDate.setFullYear(startDate.getFullYear() - YEARS_OF_HISTORY);
const iso = (d) => d.toISOString().split('T')[0];

const url =
  `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUDE}` +
  `&longitude=${LONGITUDE}&start_date=${iso(startDate)}&end_date=${iso(endDate)}` +
  `&daily=temperature_2m_mean&temperature_unit=celsius&timezone=auto`;

const res = await fetch(url);
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
  if (typeof value === 'number' && !Number.isNaN(value)) {
    flat[dateString] = Math.round(value * 10) / 10;
  }
});

const snapshot = {
  generatedAt: new Date().toISOString(),
  location: { latitude: LATITUDE, longitude: LONGITUDE, name: NAME },
  flat,
};

await writeFile(OUT_FILE, JSON.stringify(snapshot));
console.log(
  `wrote ${OUT_FILE}: ${Object.keys(flat).length} daily records ` +
    `(${iso(startDate)} → ${iso(endDate)})`,
);
