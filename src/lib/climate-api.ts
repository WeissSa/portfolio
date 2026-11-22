/**
 * Open-Meteo client — ported from the legacy lib/useWeather.ts (same
 * endpoints, same Toronto coordinates, same 30-year window), extended with
 * the REWORK_PLAN §4.4 pipeline: live fetch → localStorage cache →
 * build-time bundled snapshot → graceful failure.
 */
import { CLIMATE_LOCATION, CLIMATE_YEARS_OF_HISTORY } from '../content/climate';
import type { FlatTemps } from './climate';

export interface ClimatePayload {
  currentTemp: number | null;
  locationName: string | null;
  flat: FlatTemps;
}

export type ClimateOutcome =
  | { status: 'live'; data: ClimatePayload; fetchedAt: number; stale: false }
  | { status: 'cache'; data: ClimatePayload; fetchedAt: number; stale: boolean }
  | {
      status: 'snapshot';
      data: ClimatePayload;
      fetchedAt: number | null;
      stale: false;
    }
  | { status: 'error'; error: string };

export interface SnapshotData {
  flat: FlatTemps;
  /** `generatedAt` from the JSON file, converted to epoch ms when valid. */
  generatedAt: number | null;
}

export const CACHE_KEY = 'portfolio.climate.v1';
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CacheEntry {
  fetchedAt: number;
  data: ClimatePayload;
}

const toDateParam = (d: Date): string => d.toISOString().split('T')[0] ?? '';

/** Same default window as the legacy hook: [today − 30 years, today]. */
export function defaultDateRange(now: Date = new Date()): {
  start: string;
  end: string;
} {
  const startDate = new Date(now);
  startDate.setFullYear(startDate.getFullYear() - CLIMATE_YEARS_OF_HISTORY);
  return { start: toDateParam(startDate), end: toDateParam(now) };
}

const lat = CLIMATE_LOCATION.latitude;
const lon = CLIMATE_LOCATION.longitude;

export function currentWeatherUrl(): string {
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius&timezone=auto`;
}

export function archiveUrl(start: string, end: string): string {
  return `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&daily=temperature_2m_mean&temperature_unit=celsius&timezone=auto`;
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed (HTTP ${res.status})`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/** Live fetch, mirroring the legacy hook's two requests and validation. */
export async function fetchLiveClimate(
  now: Date = new Date(),
): Promise<ClimatePayload> {
  const { start, end } = defaultDateRange(now);

  const currentWeatherData = (await fetchJson(currentWeatherUrl())) as {
    current_weather?: { temperature?: unknown };
  };
  const currentTemp = currentWeatherData?.current_weather?.temperature;
  if (typeof currentTemp !== 'number') {
    throw new Error('Could not fetch current temperature.');
  }

  const historicalWeatherData = (await fetchJson(archiveUrl(start, end))) as {
    daily?: { temperature_2m_mean?: unknown; time?: unknown };
  };
  const means: unknown = historicalWeatherData?.daily?.temperature_2m_mean;
  const times: unknown = historicalWeatherData?.daily?.time;
  if (
    !Array.isArray(means) ||
    means.length === 0 ||
    !Array.isArray(times) ||
    times.length === 0
  ) {
    throw new Error('Could not fetch historical temperature data.');
  }

  const flat: FlatTemps = {};
  times.forEach((dateString: string, index: number) => {
    const value = means[index];
    if (typeof value === 'number' && !Number.isNaN(value)) {
      flat[dateString] = value;
    }
  });

  return {
    currentTemp,
    locationName: CLIMATE_LOCATION.name,
    flat,
  };
}

export function loadCache(nowMs: number = Date.now()): CacheEntry | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (
      typeof parsed?.fetchedAt !== 'number' ||
      typeof parsed?.data?.flat !== 'object' ||
      parsed.data.flat === null
    ) {
      return null;
    }
    if (nowMs - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function loadCacheEntryIgnoringAge(): CacheEntry | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (
      typeof parsed?.fetchedAt !== 'number' ||
      typeof parsed?.data?.flat !== 'object' ||
      parsed.data.flat === null
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveCache(
  data: ClimatePayload,
  nowMs: number = Date.now(),
): void {
  try {
    const entry: CacheEntry = { fetchedAt: nowMs, data };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Storage full/blocked (private mode) — non-fatal.
  }
}

/** Build-time snapshot fallback (public/climate-snapshot.json). */
export async function fetchSnapshot(
  baseUrl: string = import.meta.env.BASE_URL,
): Promise<SnapshotData | null> {
  try {
    const res = await fetch(`${baseUrl}climate-snapshot.json`);
    if (!res.ok) return null;
    const parsed = (await res.json()) as {
      flat?: FlatTemps;
      generatedAt?: unknown;
    };
    if (!parsed || typeof parsed.flat !== 'object' || parsed.flat === null) {
      return null;
    }
    const generatedMs =
      typeof parsed.generatedAt === 'string'
        ? Date.parse(parsed.generatedAt)
        : Number.NaN;
    return {
      flat: parsed.flat,
      generatedAt: Number.isFinite(generatedMs) ? generatedMs : null,
    };
  } catch {
    return null;
  }
}

/** Honest, human-readable age of the data currently on screen. */
export function formatDataAge(
  fetchedAt: number,
  nowMs: number = Date.now(),
): string {
  if (!Number.isFinite(fetchedAt)) return 'unknown age';
  const ageMs = Math.max(0, nowMs - fetchedAt);
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return 'just now';
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 1) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * Full pipeline: live → fresh cache → snapshot → stale cache → error.
 *
 * A successful live fetch refreshes the localStorage cache. When the live API
 * fails, a cache entry within its TTL is still preferred; beyond the TTL the
 * bundled snapshot wins so arbitrarily old cached data can never masquerade
 * as "current". An expired cache is used only as a last resort, and is
 * flagged `stale` so the UI can disclose its age.
 */
export async function loadClimateData(
  now: Date = new Date(),
): Promise<ClimateOutcome> {
  try {
    const data = await fetchLiveClimate(now);
    saveCache(data, now.getTime());
    return { status: 'live', data, fetchedAt: now.getTime(), stale: false };
  } catch (liveError) {
    const fresh = loadCache(now.getTime());
    if (fresh) {
      return {
        status: 'cache',
        data: fresh.data,
        fetchedAt: fresh.fetchedAt,
        stale: false,
      };
    }

    const snapshot = await fetchSnapshot();
    if (snapshot) {
      return {
        status: 'snapshot',
        data: {
          currentTemp: null,
          locationName: CLIMATE_LOCATION.name,
          flat: snapshot.flat,
        },
        fetchedAt: snapshot.generatedAt,
        stale: false,
      };
    }

    const staleCache = loadCacheEntryIgnoringAge();
    if (staleCache) {
      return {
        status: 'cache',
        data: staleCache.data,
        fetchedAt: staleCache.fetchedAt,
        stale: true,
      };
    }

    const message =
      liveError instanceof Error ? liveError.message : String(liveError);
    return { status: 'error', error: message };
  }
}
