/**
 * Pure climate math — ported from the legacy Next.js app
 * (lib/useWeather.ts transforms + components/WeatherCheck/WeatherCalendar.tsx
 * level/mean logic). Deliberately framework-free for unit testing and reuse
 * by the 3D projector zone (REWORK_PLAN §4.4).
 */

/** year → month (0-indexed) → day (1-indexed) → mean temperature (°C). */
export type HistoricalData = Record<
  number,
  Record<number, Record<number, number>>
>;

/** Flat Open-Meteo/snapshot shape: 'YYYY-MM-DD' → mean temperature (°C). */
export type FlatTemps = Record<string, number>;

/**
 * Sentinel ported from WeatherCalendar: marks "hottest day on record"
 * before conversion into a heatmap level.
 */
export const HOTTEST_ON_RECORD = 12000;

/** Heatmap levels → colors, ported from the legacy Heatmap color list
 *  ['gray','blue','cyan','green','orange','coral','red'] as concrete hex
 *  values with AA-friendly contrast against the ink background. */
export const LEVEL_COLORS = [
  '#6b7280', // 0 no data (gray)
  '#3b82f6', // 1 colder (blue)
  '#22d3ee', // 2 colder (cyan)
  '#22c55e', // 3 normal (green)
  '#f97316', // 4 hotter (orange)
  '#ff7f50', // 5 hotter (coral)
  '#ef4444', // 6 hottest on record (red)
] as const;

/**
 * Port of the legacy `initialHistoricalData` → nested-shape transform.
 * Deviation (bug fix, documented in the PR report): the legacy code parsed
 * 'YYYY-MM-DD' with `new Date(...)` (UTC midnight), which shifted every
 * record one day back in negative-UTC-offset timezones — including Toronto,
 * the site's own location. Date parts are now parsed as local calendar
 * values, matching Open-Meteo's `timezone=auto` semantics.
 */
export function flatToHistorical(flat: FlatTemps): HistoricalData {
  const out: HistoricalData = {};
  for (const [dateString, value] of Object.entries(flat)) {
    if (typeof value !== 'number' || Number.isNaN(value)) continue;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
    if (!match) continue;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1; // 0-indexed, as in the legacy hook
    const day = Number(match[3]);
    const yearData = (out[year] ??= {});
    const monthData = (yearData[month] ??= {});
    monthData[day] = value;
  }
  return out;
}

/** All recorded temperatures for a calendar month/day across every year.
 *  Note: unlike the legacy truthiness check, 0°C values are kept (they are
 *  real data). */
export function historicalTempsFor(
  historical: HistoricalData,
  month0: number,
  day: number,
): number[] {
  const temps: number[] = [];
  for (const year of Object.keys(historical)) {
    const value = historical[Number(year)]?.[month0]?.[day];
    if (value != null && !Number.isNaN(value)) {
      temps.push(value);
    }
  }
  return temps;
}

export function historicalAverage(
  historical: HistoricalData,
  month0: number,
  day: number,
): number | null {
  const temps = historicalTempsFor(historical, month0, day);
  if (temps.length === 0) return null;
  return temps.reduce((sum, temp) => sum + temp, 0) / temps.length;
}

export interface TodayComparison {
  mean: number;
  difference: number;
}

/** "Is Today Weirdly Hot/Cold?" computation ported from WeatherCheck. */
export function todayComparison(
  historical: HistoricalData,
  currentTemp: number,
  today: Date,
): TodayComparison | null {
  const mean = historicalAverage(historical, today.getMonth(), today.getDate());
  if (mean === null) return null;
  return { mean, difference: currentTemp - mean };
}

/**
 * Heatmap level for an anomaly, ported from WeatherCalendar.getTemperatureLevel:
 * null/NaN → 0 · sentinel → 6 · ≥5 → 5 · ≥1 → 4 · ≥-1 → 3 · ≥-5 → 2 · else 1.
 * (The legacy `diff <= -5 → 1` branch was shadowed by `diff >= -5 → 2`; the
 * observable behavior — -5 exactly maps to 2, below -5 maps to 1 — is kept.)
 */
export function temperatureLevel(diff: number | null): number {
  if (diff === null || Number.isNaN(diff)) return 0;
  if (diff === HOTTEST_ON_RECORD) return 6;
  if (diff >= 5) return 5;
  if (diff >= 1) return 4;
  if (diff >= -1) return 3;
  if (diff >= -5) return 2;
  return 1;
}

export interface HeatmapCell {
  /** 'YYYY-MM-DD' */
  date: string;
  level: number;
  temp: number | null;
  mean: number | null;
  hottestOnRecord: boolean;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Full-year heatmap series, ported from WeatherCalendar's heatmapData memo.
 * Deviation (bug fix, documented in the PR report): the legacy code fed
 * `getTemperatureLevel(HOTTEST_ON_RECORD)` (=6) back through
 * `getTemperatureLevel` again, so "hottest day on record" rendered as level
 * 5 and the red legend entry was unreachable. Here it maps to level 6.
 */
export function heatmapForYear(
  historical: HistoricalData,
  year: number,
): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${pad2(month + 1)}-${pad2(day)}`;
      const temp = historical[year]?.[month]?.[day];
      if (temp == null) {
        cells.push({
          date,
          level: 0,
          temp: null,
          mean: null,
          hottestOnRecord: false,
        });
        continue;
      }
      const temps = historicalTempsFor(historical, month, day);
      const mean = historicalAverage(historical, month, day);
      const hottestOnRecord =
        mean !== null && temps.length > 0 && Math.max(...temps) === temp;
      const level = hottestOnRecord
        ? 6
        : temperatureLevel(mean === null ? null : temp - mean);
      cells.push({ date, level, temp, mean, hottestOnRecord });
    }
  }
  return cells;
}

/** Emoji meter ported verbatim from WeatherCheck.getClimateMeterEmoji. */
export function climateMeterEmoji(diff: number | null): string {
  if (diff === null) return '🌡️';
  if (diff > 5) return '🔥';
  if (diff > 2) return '☀️';
  if (diff < -5) return '🥶';
  if (diff < -2) return '❄️';
  return '🍃';
}

/** Year selector options: last 30 years, newest first (legacy behavior). */
export function availableYears(currentYear: number): number[] {
  const years: number[] = [];
  for (let i = 0; i < 30; i++) {
    years.push(currentYear - i);
  }
  return years;
}

/**
 * Years that actually have data in a loaded dataset (live fetch or bundled
 * snapshot), newest first. The year selector uses this so it can never offer
 * a year with no underlying snapshot/archive data — e.g. when the build-time
 * refresh failed and the last-good snapshot is several months old.
 */
export function yearsWithData(historical: HistoricalData): number[] {
  return Object.keys(historical)
    .map(Number)
    .filter(
      (year) =>
        Number.isInteger(year) &&
        Object.keys(historical[year] ?? {}).length > 0,
    )
    .sort((a, b) => b - a);
}
