/**
 * All climate data/derivation logic for the single Climate surface. The view
 * itself stays presentational: it only renders the values this hook returns.
 */
import { useEffect, useMemo } from 'react';
import { formatDataAge } from './climate-api';
import {
  availableYears,
  heatmapForYear,
  reconcileSelectedYear,
  todayComparison,
  yearsWithData,
  type HeatmapCell,
  type TodayComparison,
} from './climate';
import { usePortfolioStore } from '../state/store';

export interface ClimateViewModel {
  years: number[];
  renderYear: number;
  comparison: TodayComparison | null;
  cells: HeatmapCell[];
  loading: boolean;
  sourceLabel: string | null;
  ageLabel: string | null;
}

export function useClimateViewModel(): ClimateViewModel {
  const climate = usePortfolioStore((s) => s.climate);
  const loadClimate = usePortfolioStore((s) => s.loadClimate);
  const selectedYear = usePortfolioStore((s) => s.selectedClimateYear);
  const setSelectedYear = usePortfolioStore((s) => s.setSelectedClimateYear);

  useEffect(() => {
    void loadClimate();
  }, [loadClimate]);

  // Only offer years that actually have data; a failed refresh can leave an
  // older (but still valid) snapshot available.
  const years = useMemo(() => {
    const withData = yearsWithData(climate.historical);
    return withData.length > 0
      ? withData
      : availableYears(new Date().getFullYear());
  }, [climate.historical]);

  const renderYear = reconcileSelectedYear(selectedYear, years);

  useEffect(() => {
    if (years.length > 0 && renderYear !== selectedYear) {
      setSelectedYear(renderYear);
    }
  }, [years, renderYear, selectedYear, setSelectedYear]);

  const comparison = useMemo(
    () =>
      climate.currentTemp === null
        ? null
        : todayComparison(climate.historical, climate.currentTemp, new Date()),
    [climate.currentTemp, climate.historical],
  );

  const cells = useMemo(
    () =>
      climate.status === 'ready'
        ? heatmapForYear(climate.historical, renderYear)
        : [],
    [climate.historical, climate.status, renderYear],
  );

  const sourceLabel =
    climate.source === 'live'
      ? 'live Open-Meteo'
      : climate.source === 'cache'
        ? 'local cache'
        : climate.source === 'snapshot'
          ? 'bundled snapshot'
          : null;
  const ageLabel =
    climate.fetchedAt !== null ? formatDataAge(climate.fetchedAt) : null;

  return {
    years,
    renderYear,
    comparison,
    cells,
    loading: climate.status === 'idle' || climate.status === 'loading',
    sourceLabel,
    ageLabel,
  };
}
