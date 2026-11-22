/**
 * Climate zone copy — ported verbatim from components/WeatherCheck/* and
 * lib/useWeather.ts of the legacy Next.js app.
 */
import {
  CLIMATE_LATITUDE,
  CLIMATE_LOCATION_NAME,
  CLIMATE_LONGITUDE,
  CLIMATE_YEARS_OF_HISTORY,
} from './climate-config.mjs';

/** Toronto coordinates exactly as used by the legacy useWeather hook. */
export const CLIMATE_LOCATION = {
  latitude: CLIMATE_LATITUDE,
  longitude: CLIMATE_LONGITUDE,
  name: CLIMATE_LOCATION_NAME,
} as const;

/** Number of years of history the widgets compare against. */
export { CLIMATE_YEARS_OF_HISTORY };

export const CLIMATE_TITLE = 'Our Climate, Our Future';

export const CLIMATE_STATEMENT =
  "For almost 10 years I have reduced my consumption of fossil fuels and other carbon-intensive activities. I do this because I believe that individual actions can collectively make a significant impact on our planet's health. By understanding local weather patterns and their changes, we can better advocate for policies and practices that support sustainability and resilience in our communities.";

export const TODAY_WIDGET_TITLE = 'Is Today Weirdly Hot/Cold?';

export const TODAY_WIDGET_COPY = {
  currentTemperaturePrefix: 'Current temperature in',
  historicalMeanPrefix: 'Historical mean for this period (last 30 years):',
  comparisonPrefix: 'This is',
  hotter: 'hotter',
  colder: 'colder',
  comparisonSuffix: 'than usual for this date!',
  loading: 'Fetching weather data...',
} as const;

export const HEATMAP_TITLE_PREFIX = 'Historical Weather Heatmap for';
export const HEATMAP_YEAR_LABEL = 'Select Year';
export const HEATMAP_LOADING = 'Loading historical data...';

/** Legend labels verbatim from the WeatherCalendar badges. */
export const HEATMAP_LEGEND: readonly string[] = [
  'Hottest day on record',
  '>5°C Hotter',
  '>2°C Hotter',
  'Normal',
  '< -2°C Colder',
  '< -5°C Colder',
  'No Data',
];

export const CLIMATE_ATTRIBUTION = {
  weatherProviderLabel: 'Weather data provided by:',
  openMeteo: {
    label: 'Open-Meteo.com',
    url: 'https://open-meteo.com/',
  },
  supportLabel: 'Support climate action:',
  climateDefenseFund: {
    label: 'Climate Defense Fund of Ontario',
    url: 'https://www.climatesolutions.ca/climate-defense-fund-ontario',
  },
} as const;

export const CLIMATE_UNAVAILABLE_MESSAGE =
  'Climate data is temporarily unavailable. Live weather data comes from Open-Meteo; a bundled snapshot is used as a fallback when the API cannot be reached.';
