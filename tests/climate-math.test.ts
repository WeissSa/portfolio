import { describe, expect, it } from 'vitest';
import {
  availableYears,
  climateMeterEmoji,
  flatToHistorical,
  heatmapForYear,
  historicalAverage,
  HOTTEST_ON_RECORD,
  temperatureLevel,
  todayComparison,
  yearsWithData,
  type HistoricalData,
} from '../src/lib/climate';

describe('flatToHistorical (ported legacy transform, TZ-safe)', () => {
  it('nests flat date records by calendar year/month/day', () => {
    const historical = flatToHistorical({ '2021-07-15': 19.5 });
    expect(historical[2021]?.[6]?.[15]).toBe(19.5);
  });

  it('skips NaN values and malformed dates', () => {
    const historical = flatToHistorical({
      'not-a-date': 5,
      '2021-07-15': Number.NaN,
    });
    expect(Object.keys(historical)).toHaveLength(0);
  });
});

describe('historicalAverage', () => {
  const historical: HistoricalData = {
    2019: { 6: { 15: 20 } },
    2020: { 6: { 15: 22 } },
    2021: { 6: { 15: 0 } }, // 0°C is real data (legacy truthiness bug fixed)
  };

  it('averages across years including 0°C readings', () => {
    expect(historicalAverage(historical, 6, 15)).toBeCloseTo(
      (20 + 22 + 0) / 3,
      10,
    );
  });

  it('returns null when there is no data', () => {
    expect(historicalAverage(historical, 0, 1)).toBeNull();
  });
});

describe('temperatureLevel (ported thresholds)', () => {
  it.each([
    [null, 0],
    [Number.NaN, 0],
    [HOTTEST_ON_RECORD, 6],
    [7, 5],
    [5, 5],
    [4.9, 4],
    [1, 4],
    [0.9, 3],
    [-1, 3],
    [-1.1, 2],
    [-5, 2],
    [-5.1, 1],
    [-20, 1],
  ])('maps %s to level %s', (diff, level) => {
    expect(temperatureLevel(diff)).toBe(level);
  });
});

describe('climateMeterEmoji (ported thresholds)', () => {
  it.each([
    [null, '🌡️'],
    [5.1, '🔥'],
    [5, '☀️'],
    [2.1, '☀️'],
    [2, '🍃'],
    [0, '🍃'],
    [-2, '🍃'],
    [-2.1, '❄️'],
    [-5, '❄️'],
    [-5.1, '🥶'],
  ])('maps %s to %s', (diff, emoji) => {
    expect(climateMeterEmoji(diff)).toBe(emoji);
  });
});

describe('todayComparison (ported WeatherCheck math)', () => {
  it('computes mean and difference for today', () => {
    const today = new Date();
    const month = today.getMonth();
    const day = today.getDate();
    const historical: HistoricalData = {
      2000: { [month]: { [day]: 8 } },
      2001: { [month]: { [day]: 12 } },
    };
    const result = todayComparison(historical, 25, today);
    expect(result).not.toBeNull();
    expect(result?.mean).toBeCloseTo(10, 10);
    expect(result?.difference).toBeCloseTo(15, 10);
  });

  it('returns null without historical data for today', () => {
    expect(todayComparison({}, 25, new Date())).toBeNull();
  });
});

describe('heatmapForYear', () => {
  const historical: HistoricalData = {
    2020: { 0: { 1: 5, 2: 2 } },
    2021: { 0: { 1: 9, 2: 8 } },
    2022: { 0: { 1: 7, 2: 10 } },
  };

  it('produces one cell per day of the year', () => {
    const cells = heatmapForYear(historical, 2021);
    expect(cells).toHaveLength(365);
    expect(cells[0]?.date).toBe('2021-01-01');
  });

  it('marks the hottest day on record as level 6', () => {
    const cells = heatmapForYear(historical, 2021);
    const jan1 = cells[0];
    expect(jan1?.hottestOnRecord).toBe(true);
    expect(jan1?.level).toBe(6);
  });

  it('levels ordinary anomalies against the multi-year average', () => {
    const cells = heatmapForYear(historical, 2021);
    const jan2 = cells[1];
    // mean of [2, 8, 10] = 6⅔ → diff +1⅓ → level 4 (not the record max)
    expect(jan2?.level).toBe(4);
    expect(jan2?.hottestOnRecord).toBe(false);
  });

  it('gives level 0 to days without data', () => {
    const cells = heatmapForYear(historical, 2021);
    const dec31 = cells[364];
    expect(dec31?.level).toBe(0);
    expect(dec31?.temp).toBeNull();
  });
});

describe('availableYears', () => {
  it('lists the last 30 years newest first', () => {
    const years = availableYears(2026);
    expect(years).toHaveLength(30);
    expect(years[0]).toBe(2026);
    expect(years[29]).toBe(1997);
  });
});

describe('yearsWithData', () => {
  it('returns only years that actually have records, newest first', () => {
    const historical: HistoricalData = {
      2021: { 0: { 1: 5 } },
      2026: {}, // present but empty — must not be offered by the selector
      2019: { 6: { 15: 20 } },
      2024: { 11: { 31: -3 } },
    };
    expect(yearsWithData(historical)).toEqual([2024, 2021, 2019]);
  });

  it('returns an empty list when the snapshot has no usable years', () => {
    expect(yearsWithData({})).toEqual([]);
  });
});
