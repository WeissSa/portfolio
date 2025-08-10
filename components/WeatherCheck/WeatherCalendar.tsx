import React, { useCallback, useMemo, useState } from 'react'; // Import useState
import { Heatmap } from '@mantine/charts'; // Import Heatmap
import { Text, Group, Badge, Select, Box } from '@mantine/core'; // Import Select

interface WeatherCalendarProps {
  historicalData: Record<number, Record<number, Record<number, number>>>;
  loading: boolean;
  error: string | null;
}

const HOTTEST_ON_RECORD = 12000;

const WeatherCalendar: React.FC<WeatherCalendarProps> = ({
  historicalData,
  loading,
  error,
}) => {
  const [selectedYear, setSelectedYear] = useState<string>(
    new Date().getFullYear().toString(),
  );

  const getHistoricalAverage = useCallback(
    (month: number, day: number): Array<number | number[]> | null => {
      const relevantTemps: number[] = [];
      for (const year in historicalData) {
        if (historicalData[year][month] && historicalData[year][month][day]) {
          relevantTemps.push(historicalData[year][month][day]);
        }
      }

      if (relevantTemps.length === 0) {
        return null;
      }
      return [
        relevantTemps.reduce((sum, temp) => sum + temp, 0) /
          relevantTemps.length,
        relevantTemps,
      ];
    },
    [historicalData],
  );
  const getTemperatureLevel = (diff: number | null): number => {
    if (diff === null || isNaN(diff)) return 0; // No data / default level (e.g., gray)
    if (diff == HOTTEST_ON_RECORD) return 6; // Level 6: Hottest day on record (red)
    if (diff >= 5) return 5; // Level 5: >= 5°C Hotter (coral))
    if (diff >= 1) return 4; // Level 4: >= 0.5°C Hotter (Orange)
    if (diff >= -1) return 3; // Level 3: Normal (Green)
    if (diff >= -5) return 2; // Level 2: <= -2.5°C Colder (Cyan)
    if (diff <= -5) return 1; // Level 1: <= -5°C Colder (Blue)

    return 0; // Fallback
  };

  // Prepare data for Heatmap
  const heatmapData: Record<string, number> = useMemo(() => {
    const data = [];
    const yearToDisplay = parseInt(selectedYear);

    for (let month = 0; month < 12; month++) {
      const daysInMonth = new Date(yearToDisplay, month + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        let actualTemp; // Use selected year
        if (
          historicalData &&
          historicalData[yearToDisplay] &&
          historicalData[yearToDisplay][month] &&
          historicalData[yearToDisplay][month][day]
        ) {
          actualTemp = historicalData[yearToDisplay][month][day];
        }
        if (actualTemp === undefined) {
          // Format date as YYYY-MM-DD with leading zeros
          const formattedMonth = String(month + 1).padStart(2, '0');
          const formattedDay = String(day).padStart(2, '0');
          const dateString = `${yearToDisplay}-${formattedMonth}-${formattedDay}`;

          data.push([dateString, 0]);
        } else {
          const historicalAverage = getHistoricalAverage(month, day);

          let difference: number | null = null;
          if (actualTemp !== undefined && historicalAverage !== null) {
            difference = actualTemp - (historicalAverage[0] as number);
          }

          if (
            historicalAverage != null &&
            Math.max(...(historicalAverage[1] as number[])) === actualTemp
          ) {
            difference = getTemperatureLevel(HOTTEST_ON_RECORD);
          }

          // Format date as YYYY-MM-DD with leading zeros
          const formattedMonth = String(month + 1).padStart(2, '0');
          const formattedDay = String(day).padStart(2, '0');
          const dateString = `${yearToDisplay}-${formattedMonth}-${formattedDay}`;

          data.push([dateString, getTemperatureLevel(difference)]);
        }
      }
    }
    return Object.fromEntries(data);
  }, [historicalData, selectedYear]); // Add selectedYear to dependencies

  const yearOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 30; i++) {
      // Last 30 years
      const year = currentYear - i;
      options.push({ value: year.toString(), label: year.toString() });
    }
    return options;
  }, []);

  const getTemperatureLevelOnDate = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    return historicalData[year]![month - 1]![day]!;
  };

  const getHistoricalAverageOnDate = (date: string) => {
    const [_, month, day] = date.split('-').map(Number);
    return getHistoricalAverage(month - 1, day)![0] as number;
  };
  return (
    <Box style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
      <h3>Historical Weather Heatmap for {selectedYear}</h3>
      <Select
        label="Select Year"
        placeholder="Pick one"
        data={yearOptions}
        value={selectedYear}
        onChange={(value) =>
          setSelectedYear(value || new Date().getFullYear().toString())
        }
        mb="md"
      />
      {loading && <p>Loading historical data...</p>}
      {error && <p>Error: {error}</p>}
      <Box flex={1} dir="row">
        {!loading && !error && (
          <Heatmap
            data={heatmapData}
            withTooltip
            withWeekdayLabels
            withMonthLabels
            startDate={new Date(Number(selectedYear), 0, 1)}
            endDate={new Date(Number(selectedYear), 11, 31)}
            colors={['gray', 'blue', 'cyan', 'green', 'orange', 'coral', 'red']}
            getTooltipLabel={({
              date,
              value,
            }: {
              date: string | null;
              value: number | null;
            }) =>
              date && value
                ? `${date}: was ${getTemperatureLevelOnDate(date).toFixed(1)}° which is ${Math.abs(getTemperatureLevelOnDate(date) - getHistoricalAverageOnDate(date)).toFixed(1)}° ${
                    getTemperatureLevelOnDate(date) >
                    getHistoricalAverageOnDate(date)
                      ? 'above'
                      : 'below'
                  } the historical average of ${getHistoricalAverageOnDate(date).toFixed(1)}°`
                : 'No Data'
            }
          />
        )}
        <Text size="sm" mt="md">
          <strong>Legend:</strong>
        </Text>
        <Group mt="xs" dir="col">
          <Badge color="red" variant="filled">
            Hottest day on record
          </Badge>
          <Badge color="coral" variant="filled">
            {'>'}5°C Hotter
          </Badge>
          <Badge color="orange" variant="filled">
            {'>'}2°C Hotter
          </Badge>
          <Badge color="green" variant="filled">
            Normal
          </Badge>
          <Badge color="cyan" variant="filled">
            {'<'} -2°C Colder
          </Badge>
          <Badge color="blue" variant="filled">
            {'<'} -5°C Colder
          </Badge>
          <Badge color="gray" variant="filled">
            No Data
          </Badge>
        </Group>
      </Box>
    </Box>
  );
};

export default WeatherCalendar;
