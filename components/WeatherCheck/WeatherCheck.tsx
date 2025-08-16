import React, { useState, useEffect } from 'react';
import { Title, Text, Box, Paper, Loader, Center, Grid } from '@mantine/core';
import { useWeather } from '../../lib/useWeather';
import WeatherCalendar from './WeatherCalendar'; // Import WeatherCalendar
import styles from './weather-check.module.css'; // Import CSS module

const WeatherCheck: React.FC = () => {
  const { weatherData, historicalData, loading, error } = useWeather(
    undefined,
    undefined,
    undefined,
    new Date().getFullYear(),
  );
  const today = new Date(); // Keep today for calculating historical mean

  const [displayHistoricalMean, setDisplayHistoricalMean] = useState<
    number | null
  >(null);
  const [displayDifference, setDisplayDifference] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (weatherData.currentTemp !== null && historicalData) {
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      const relevantHistoricalTemps: number[] = [];
      for (const year in historicalData) {
        if (
          historicalData[year][todayMonth] &&
          historicalData[year][todayMonth][todayDay]
        ) {
          relevantHistoricalTemps.push(
            historicalData[year][todayMonth][todayDay],
          );
        }
      }

      if (relevantHistoricalTemps.length > 0) {
        const mean =
          relevantHistoricalTemps.reduce((sum, temp) => sum + temp, 0) /
          relevantHistoricalTemps.length;
        setDisplayHistoricalMean(mean);
        setDisplayDifference(weatherData.currentTemp - mean);
      } else {
        setDisplayHistoricalMean(null);
        setDisplayDifference(null);
      }
    }
  }, [weatherData.currentTemp, historicalData, today]);

  const getClimateMeterEmoji = (diff: number | null) => {
    if (diff === null) return '🌡️';
    if (diff > 5) return '🔥'; // Significantly hotter
    if (diff > 2) return '☀️'; // Hotter
    if (diff < -5) return '🥶'; // Significantly colder
    if (diff < -2) return '❄️'; // Colder
    return '🍃'; // Normal
  };
  return (
    <Box py="xl" className={styles.dynamicBackground}>
      <Paper shadow="sm" p="xl" withBorder className={styles.container}>
        <Title order={2} mb="md">
          Our Climate, Our Future
        </Title>
        <Text size="lg" mb="xl" style={{ textAlign: 'left' }}>
          For almost 10 years I have reduced my consumption of fossil fuels and
          other carbon-intensive activities. I do this because I believe that
          individual actions can collectively make a significant impact on our
          planet&apos;s health. By understanding local weather patterns and
          their changes, we can better advocate for policies and practices that
          support sustainability and resilience in our communities.
        </Text>

        <Title order={3} mb="md">
          Is Today Weirdly Hot/Cold?
        </Title>

        <Grid gutter="xl">
          <Grid.Col span={12}>
            {loading && (
              <Center my="xl">
                <Loader size="lg" />
                <Text ml="md">Fetching weather data...</Text>
              </Center>
            )}

            {error && (
              <Text color="red" my="xl">
                Error: {error}
              </Text>
            )}

            {!loading &&
              !error &&
              weatherData.currentTemp !== null &&
              displayHistoricalMean !== null && (
                <>
                  <Text mb="md">
                    Current temperature in {weatherData.locationName}:{' '}
                    <strong>{weatherData.currentTemp.toFixed(1)}°C</strong>
                  </Text>
                  <Text mb="xl">
                    Historical mean for this period (last 30 years):{' '}
                    <strong>{displayHistoricalMean.toFixed(1)}°C</strong>
                  </Text>
                  <Text size="lg" mb="xl">
                    This is{' '}
                    <strong>
                      {displayDifference && displayDifference > 0 ? '+' : ''}
                      {displayDifference?.toFixed(1)}°C
                    </strong>{' '}
                    {displayDifference && displayDifference > 0
                      ? 'hotter'
                      : 'colder'}{' '}
                    than usual for this date!
                  </Text>

                  <Text mb="md" style={{ fontSize: '5rem' }}>
                    {getClimateMeterEmoji(displayDifference)}
                  </Text>
                </>
              )}
          </Grid.Col>
          <Grid.Col span={12}>
            <Paper shadow="sm" p="md" withBorder>
              <WeatherCalendar
                historicalData={historicalData}
                loading={loading}
                error={error}
              />
            </Paper>
          </Grid.Col>
        </Grid>

        <Text size="sm" mt="md" style={{ textAlign: 'left' }}>
          Weather data provided by:{' '}
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open-Meteo.com
          </a>
        </Text>
        <Text size="sm" style={{ textAlign: 'left' }}>
          Support climate action:{' '}
          <a
            href="https://www.climatesolutions.ca/climate-defense-fund-ontario"
            target="_blank"
            rel="noopener noreferrer"
          >
            Climate Defense Fund of Ontario
          </a>
        </Text>
      </Paper>
    </Box>
  );
};

export default WeatherCheck;
