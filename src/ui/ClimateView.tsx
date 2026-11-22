import { useEffect, useMemo } from 'react';
import {
  CLIMATE_ATTRIBUTION,
  CLIMATE_STATEMENT,
  CLIMATE_TITLE,
  CLIMATE_UNAVAILABLE_MESSAGE,
  HEATMAP_LEGEND,
  HEATMAP_TITLE_PREFIX,
  HEATMAP_YEAR_LABEL,
  TODAY_WIDGET_COPY,
  TODAY_WIDGET_TITLE,
} from '../content/climate';
import { formatDataAge } from '../lib/climate-api';
import {
  availableYears,
  climateMeterEmoji,
  heatmapForYear,
  heatmapLegendColor,
  reconcileSelectedYear,
  todayComparison,
  yearsWithData,
} from '../lib/climate';
import { usePortfolioStore } from '../state/store';
import { DisplayTitle, P5Panel } from './primitives';
import { HeatmapCanvas } from './HeatmapCanvas';

/**
 * The Projector zone in 2D: climate statement + BOTH live widgets ported
 * from the legacy app (today hot/cold comparison + historical heatmap with
 * year selector), Open-Meteo attribution and the Climate Defense Fund of
 * Ontario link always visible (REWORK_PLAN §3.2.4).
 */
export function ClimateView({ idPrefix = '' }: { idPrefix?: string }) {
  const climate = usePortfolioStore((s) => s.climate);
  const loadClimate = usePortfolioStore((s) => s.loadClimate);
  // Shared with the 3D projector dial (commit 9): one year across both modes.
  const selectedYear = usePortfolioStore((s) => s.selectedClimateYear);
  const setSelectedYear = usePortfolioStore((s) => s.setSelectedClimateYear);
  // The 3D dialog renders a second copy of this view; the prefix keeps the
  // heading/label ids unique so aria references and <label for> stay valid.
  const headingId = idPrefix
    ? `${idPrefix}-climate-heading`
    : 'climate-heading';
  const yearSelectId = idPrefix ? `${idPrefix}-heatmap-year` : 'heatmap-year';

  useEffect(() => {
    void loadClimate();
  }, [loadClimate]);

  // Only offer years that actually have data. A failed build-time refresh can
  // leave a months-old (but still valid) snapshot, so deriving from the loaded
  // dataset is safer than assuming the current year is present.
  const years = useMemo(() => {
    const withData = yearsWithData(climate.historical);
    return withData.length > 0
      ? withData
      : availableYears(new Date().getFullYear());
  }, [climate.historical]);

  // Shared guard with the 3D projector: never DRAW a year the dataset lacks.
  const renderYear = reconcileSelectedYear(selectedYear, years);

  useEffect(() => {
    if (years.length > 0 && renderYear !== selectedYear) {
      setSelectedYear(renderYear);
    }
  }, [years, renderYear, selectedYear, setSelectedYear]);

  const comparison = useMemo(() => {
    if (climate.currentTemp === null) return null;
    return todayComparison(climate.historical, climate.currentTemp, new Date());
  }, [climate.currentTemp, climate.historical]);

  const cells = useMemo(
    () =>
      climate.status === 'ready'
        ? heatmapForYear(climate.historical, renderYear)
        : [],
    [climate.historical, climate.status, renderYear],
  );

  const loading = climate.status === 'idle' || climate.status === 'loading';

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

  return (
    <section aria-labelledby={headingId} className="p5-cut-in">
      <DisplayTitle level={2} className="mb-4 text-p5-red">
        <span id={headingId}>{CLIMATE_TITLE}</span>
      </DisplayTitle>

      <P5Panel slashed className="mb-4">
        <p className="max-w-prose text-sm leading-relaxed">
          {CLIMATE_STATEMENT}
        </p>
      </P5Panel>

      <P5Panel slashed className="mb-4" aria-busy={loading}>
        <h3 className="p5-display mb-3 text-xl">{TODAY_WIDGET_TITLE}</h3>
        {loading && <p role="status">{TODAY_WIDGET_COPY.loading}</p>}
        {climate.status === 'error' && (
          <p role="status" className="font-bold text-p5-yellow">
            {CLIMATE_UNAVAILABLE_MESSAGE}
          </p>
        )}
        {climate.status === 'ready' && (
          <>
            {climate.currentTemp !== null && comparison ? (
              <>
                <p className="mb-1">
                  {TODAY_WIDGET_COPY.currentTemperaturePrefix}{' '}
                  {climate.locationName}:{' '}
                  <strong>{climate.currentTemp.toFixed(1)}°C</strong>
                </p>
                <p className="mb-1">
                  {TODAY_WIDGET_COPY.historicalMeanPrefix}{' '}
                  <strong>{comparison.mean.toFixed(1)}°C</strong>
                </p>
                <p className="mb-2 text-lg">
                  {TODAY_WIDGET_COPY.comparisonPrefix}{' '}
                  <strong>
                    {comparison.difference > 0 ? '+' : ''}
                    {comparison.difference.toFixed(1)}°C
                  </strong>{' '}
                  {comparison.difference > 0
                    ? TODAY_WIDGET_COPY.hotter
                    : TODAY_WIDGET_COPY.colder}{' '}
                  {TODAY_WIDGET_COPY.comparisonSuffix}
                </p>
                <p className="text-5xl" aria-hidden="true">
                  {climateMeterEmoji(comparison.difference)}
                </p>
                <p className="sr-only">
                  Mood: {climateMeterEmoji(comparison.difference)}
                </p>
              </>
            ) : (
              <p role="status">
                {climate.source === 'snapshot'
                  ? 'Showing the bundled historical snapshot — live temperature is currently unavailable, so today’s comparison cannot be computed.'
                  : 'Today’s comparison is not available yet.'}
              </p>
            )}
            {sourceLabel && (
              <p
                className="mt-2 text-xs font-bold text-p5-yellow"
                data-testid="climate-data-source"
              >
                Data source: {sourceLabel}
                {climate.source === 'snapshot' &&
                  climate.fetchedAt === null &&
                  ' (age unknown)'}
                {ageLabel && (
                  <>
                    {' '}
                    ·{' '}
                    {climate.source === 'snapshot'
                      ? 'generated'
                      : 'collected'}{' '}
                    {ageLabel}
                  </>
                )}
                {climate.isStale && (
                  <>
                    {' '}
                    · stale — live data and the bundled snapshot are
                    unavailable, so an expired cache entry is shown
                  </>
                )}
              </p>
            )}
          </>
        )}
      </P5Panel>

      <P5Panel slashed className="mb-4">
        <h3 className="p5-display mb-3 text-xl">
          {HEATMAP_TITLE_PREFIX} {renderYear}
        </h3>
        <div className="mb-4 max-w-xs">
          <label
            htmlFor={yearSelectId}
            className="mb-1 block text-sm font-bold"
          >
            {HEATMAP_YEAR_LABEL}
          </label>
          <select
            id={yearSelectId}
            value={renderYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
            className="min-h-[44px] w-full border-2 border-p5-black bg-white px-2 font-bold text-p5-black"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {loading && <p role="status">{TODAY_WIDGET_COPY.loading}</p>}
        {climate.status === 'error' && (
          <p role="status" className="font-bold text-p5-yellow">
            {CLIMATE_UNAVAILABLE_MESSAGE}
          </p>
        )}
        {climate.status === 'ready' && (
          <>
            <HeatmapCanvas cells={cells} year={renderYear} />
            <h4 className="mt-4 text-sm font-bold">Legend:</h4>
            <ul className="mt-2 flex flex-wrap gap-2">
              {HEATMAP_LEGEND.map((label, index) => (
                <li
                  key={label}
                  className="flex items-center gap-1 text-xs font-bold"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-4 w-4"
                    style={{ backgroundColor: heatmapLegendColor(index) }}
                  />
                  {label}
                </li>
              ))}
            </ul>
          </>
        )}
      </P5Panel>

      <footer className="p5-panel text-sm">
        <p>
          {CLIMATE_ATTRIBUTION.weatherProviderLabel}{' '}
          <a
            href={CLIMATE_ATTRIBUTION.openMeteo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#93c5fd] underline"
          >
            {CLIMATE_ATTRIBUTION.openMeteo.label}
          </a>{' '}
          (
          <a
            href={CLIMATE_ATTRIBUTION.license.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#93c5fd] underline"
          >
            {CLIMATE_ATTRIBUTION.license.label}
          </a>
          ) {CLIMATE_ATTRIBUTION.roundedNote}
        </p>
        <p>
          {CLIMATE_ATTRIBUTION.supportLabel}{' '}
          <a
            href={CLIMATE_ATTRIBUTION.climateDefenseFund.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#93c5fd] underline"
          >
            {CLIMATE_ATTRIBUTION.climateDefenseFund.label}
          </a>
        </p>
      </footer>
    </section>
  );
}
