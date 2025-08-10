import { useState, useEffect, useRef } from 'react';

interface WeatherData {
  currentTemp: number | null;
  historicalMean: number | null;
  difference: number | null;
  locationName: string | null;
}

const DEFAULT_LOCATION = {
  latitude: 43.6532, // Toronto latitude
  longitude: -79.3832, // Toronto longitude
  name: 'Toronto, Canada',
};

export const useWeather = (
  startDate: Date = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 30);
    return d;
  })(),
  endDate: Date = new Date(),
  initialHistoricalData?: Record<string, number>,
  defaultYear?: number, // New optional parameter for default year
) => {
  const [weatherData, setWeatherData] = useState<WeatherData>({
    currentTemp: null,
    historicalMean: null, // This will be calculated by the component
    difference: null, // This will be calculated by the component
    locationName: null,
  });
  const [historicalData, setHistoricalData] = useState<
    Record<number, Record<number, Record<number, number>>>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchedRef = useRef(false); // Flag to ensure fetch happens only once

  useEffect(() => {
    if (fetchedRef.current) {
      return; // Already fetched, do nothing
    }

    const fetchWeather = async () => {
      setLoading(true);
      setError(null);

      // If initialHistoricalData is provided, use it instead of fetching
      if (initialHistoricalData) {
        const transformedData: Record<number, Record<number, Record<number, number>>> = {};
        for (const dateString in initialHistoricalData) {
          const value = initialHistoricalData[dateString];
          const date = new Date(dateString);
          const year = date.getFullYear();
          const month = date.getMonth(); // 0-indexed
          const day = date.getDate();

          if (!transformedData[year]) {
            transformedData[year] = {};
          }
          if (!transformedData[year][month]) {
            transformedData[year][month] = {};
          }
          transformedData[year][month][day] = value;
        }
        setHistoricalData(transformedData);
        setLoading(false);
        fetchedRef.current = true; // Mark as fetched
        return; // Exit, no API call needed for historical data
      }

      const lat = DEFAULT_LOCATION.latitude;
      const lon = DEFAULT_LOCATION.longitude;
      const locName = DEFAULT_LOCATION.name;

      try {
        const currentWeatherData = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius&timezone=auto`,
        ).then((res) => res.json());

        const currentTemp = currentWeatherData?.current_weather?.temperature;

        if (currentTemp === undefined) {
          throw new Error('Could not fetch current temperature.');
        }

        // 3. Fetch historical temperature data for the given timeframe
        const historicalWeatherData = await fetch(
          `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}&daily=temperature_2m_mean&temperature_unit=celsius&timezone=auto`,
        ).then((res) => res.json());

        const historicalMeans =
          historicalWeatherData?.daily?.temperature_2m_mean;
        const historicalTimes = historicalWeatherData?.daily?.time;

        if (
          !historicalMeans ||
          historicalMeans.length === 0 ||
          !historicalTimes ||
          historicalTimes.length === 0
        ) {
          throw new Error('Could not fetch historical temperature data.');
        }

        const newHistoricalData: Record<
          number,
          Record<number, Record<number, number>>
        > = {};

        historicalTimes.forEach((dateString: string, index: number) => {
          const date = new Date(dateString);
          const year = date.getFullYear();
          const month = date.getMonth(); // 0-indexed
          const day = date.getDate();

          if (!newHistoricalData[year]) {
            newHistoricalData[year] = {};
          }
          if (!newHistoricalData[year][month]) {
            newHistoricalData[year][month] = {};
          }
          newHistoricalData[year][month][day] = historicalMeans[index];
        });

        setHistoricalData(newHistoricalData);

        // Set weatherData with current temp and location, historicalMean and difference will be calculated by component
        setWeatherData({
          currentTemp,
          historicalMean: null, // Reset, as it's now calculated by component
          difference: null, // Reset, as it's now calculated by component
          locationName: locName,
        });
      } catch (apiError: any) {
        console.error('Open-Meteo API error:', apiError);
        setError(`Failed to fetch weather data: ${apiError.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    fetchedRef.current = true; // Mark as fetched
  }, [startDate, endDate]); // Re-run when startDate or endDate changes

  return { weatherData, historicalData, loading, error, defaultYear };
};
