import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CACHE_KEY,
  archiveUrl,
  currentWeatherUrl,
  fetchLiveClimate,
  loadCache,
  loadClimateData,
  saveCache,
} from '../src/lib/climate-api';

const FLAT = {
  '1996-11-21': 1.5,
  '2020-07-15': 19.5,
};

const forecastResponse = {
  current_weather: { temperature: 25.0 },
};

const archiveResponse = {
  daily: {
    time: Object.keys(FLAT),
    temperature_2m_mean: Object.values(FLAT),
  },
};

function mockFetchByUrl(routes: {
  forecast?: unknown;
  archive?: unknown;
  snapshot?: unknown;
  failUrls?: RegExp[];
}) {
  return vi.fn(async (input: unknown) => {
    const url = String(input);
    if (routes.failUrls?.some((pattern) => pattern.test(url))) {
      throw new Error(`network failure for ${url}`);
    }
    if (url.startsWith('https://api.open-meteo.com') && routes.forecast) {
      return { ok: true, json: async () => routes.forecast } as Response;
    }
    if (
      url.startsWith('https://archive-api.open-meteo.com') &&
      routes.archive
    ) {
      return { ok: true, json: async () => routes.archive } as Response;
    }
    if (url.includes('climate-snapshot.json')) {
      if (routes.snapshot) {
        return {
          ok: true,
          json: async () => routes.snapshot,
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('URLs (ported from the legacy hook)', () => {
  it('targets the Open-Meteo forecast + archive with Toronto coords', () => {
    expect(currentWeatherUrl()).toContain('latitude=43.6532');
    expect(currentWeatherUrl()).toContain('longitude=-79.3832');
    expect(currentWeatherUrl()).toContain('current_weather=true');
    const archive = archiveUrl('1996-11-21', '2026-11-21');
    expect(archive).toContain('start_date=1996-11-21');
    expect(archive).toContain('end_date=2026-11-21');
    expect(archive).toContain('daily=temperature_2m_mean');
  });
});

describe('fetchLiveClimate', () => {
  it('combines current weather and archive into a flat payload', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchByUrl({
        forecast: forecastResponse,
        archive: archiveResponse,
      }),
    );
    const data = await fetchLiveClimate(new Date('2026-11-21T12:00:00Z'));
    expect(data.currentTemp).toBe(25.0);
    expect(data.locationName).toBe('Toronto, Canada');
    expect(data.flat).toEqual(FLAT);
  });

  it('throws when the current temperature is missing', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchByUrl({
        forecast: { current_weather: {} },
        archive: archiveResponse,
      }),
    );
    await expect(fetchLiveClimate()).rejects.toThrow(
      'Could not fetch current temperature.',
    );
  });

  it('throws when the archive is empty', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchByUrl({
        forecast: forecastResponse,
        archive: { daily: { time: [], temperature_2m_mean: [] } },
      }),
    );
    await expect(fetchLiveClimate()).rejects.toThrow(
      'Could not fetch historical temperature data.',
    );
  });
});

describe('localStorage cache', () => {
  it('round-trips a payload', () => {
    const data = {
      currentTemp: 10,
      locationName: 'Toronto, Canada',
      flat: FLAT,
    };
    saveCache(data, 1000);
    const cached = loadCache(1000);
    expect(cached?.data).toEqual(data);
  });

  it('expires entries older than the TTL', () => {
    const data = {
      currentTemp: 10,
      locationName: 'Toronto, Canada',
      flat: FLAT,
    };
    saveCache(data, 1000);
    expect(loadCache(1000 + 7 * 60 * 60 * 1000)).toBeNull();
  });

  it('survives corrupt cache entries', () => {
    window.localStorage.setItem(CACHE_KEY, '{oops');
    expect(loadCache()).toBeNull();
  });
});

describe('loadClimateData pipeline', () => {
  it('returns live data and refreshes the cache on success', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchByUrl({
        forecast: forecastResponse,
        archive: archiveResponse,
      }),
    );
    const outcome = await loadClimateData();
    expect(outcome.status).toBe('live');
    if (outcome.status === 'live') {
      expect(outcome.data.flat).toEqual(FLAT);
    }
    expect(loadCache()).not.toBeNull();
  });

  it('falls back to the cache when the live API fails', async () => {
    const data = {
      currentTemp: 10,
      locationName: 'Toronto, Canada',
      flat: FLAT,
    };
    saveCache(data);
    vi.stubGlobal('fetch', mockFetchByUrl({ failUrls: [/open-meteo\.com/] }));
    const outcome = await loadClimateData();
    expect(outcome.status).toBe('cache');
    if (outcome.status === 'cache') {
      expect(outcome.data).toEqual(data);
    }
  });

  it('falls back to the bundled snapshot when API and cache fail', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchByUrl({
        failUrls: [/open-meteo\.com/],
        snapshot: { generatedAt: 'x', flat: FLAT },
      }),
    );
    const outcome = await loadClimateData();
    expect(outcome.status).toBe('snapshot');
    if (outcome.status === 'snapshot') {
      expect(outcome.data.flat).toEqual(FLAT);
      expect(outcome.data.currentTemp).toBeNull();
    }
  });

  it('reports a graceful error when everything fails', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchByUrl({ failUrls: [/open-meteo\.com/, /climate-snapshot/] }),
    );
    const outcome = await loadClimateData();
    expect(outcome.status).toBe('error');
    if (outcome.status === 'error') {
      expect(outcome.error).toContain('network failure');
    }
  });
});
