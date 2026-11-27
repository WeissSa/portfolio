import { NativeSelect } from '@mantine/core';
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
import { climateMeterEmoji, heatmapLegendColor } from '../lib/climate';
import { useClimateViewModel } from '../lib/use-climate-view';
import { usePortfolioStore } from '../state/store';
import { DisplayTitle, P5Panel } from './primitives';
import { HeatmapCanvas } from './HeatmapCanvas';

/**
 * The Projector zone in 2D: climate statement + BOTH live widgets ported
 * from the legacy app (today hot/cold comparison + historical heatmap with
 * year selector), Open-Meteo attribution and the Climate Defense Fund of
 * Ontario link always visible (REWORK_PLAN §3.2.4).
 */
export function ClimateView() {
  const climate = usePortfolioStore((s) => s.climate);
  const setSelectedYear = usePortfolioStore((s) => s.setSelectedClimateYear);
  // Data loading and derivation are in a hook; this component only renders.
  const {
    years,
    renderYear,
    comparison,
    cells,
    loading,
    sourceLabel,
    ageLabel,
  } = useClimateViewModel();
  // ONE surface per content: the zone view and the detail are never mounted
  // together, so the ids can be plain and stable.
  const headingId = 'climate-heading';
  const yearSelectId = 'heatmap-year';

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
          <NativeSelect
            id={yearSelectId}
            label={HEATMAP_YEAR_LABEL}
            data={years.map((year) => String(year))}
            value={String(renderYear)}
            onChange={(event) =>
              setSelectedYear(Number(event.currentTarget.value))
            }
            classNames={{
              label: 'mb-1 block text-sm font-bold',
              input:
                'min-h-[44px] w-full border-2 border-p5-black bg-white px-2 font-bold text-p5-black',
            }}
          />
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
            className="font-bold text-[color:var(--p5-link)] underline"
          >
            {CLIMATE_ATTRIBUTION.openMeteo.label}
          </a>{' '}
          (
          <a
            href={CLIMATE_ATTRIBUTION.license.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[color:var(--p5-link)] underline"
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
            className="font-bold text-[color:var(--p5-link)] underline"
          >
            {CLIMATE_ATTRIBUTION.climateDefenseFund.label}
          </a>
        </p>
      </footer>
    </section>
  );
}
