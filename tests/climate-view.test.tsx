import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClimateView } from '../src/ui/ClimateView';
import { usePortfolioStore } from '../src/state/store';
import { CLIMATE_UNAVAILABLE_MESSAGE } from '../src/content/climate';

function resetStore() {
  usePortfolioStore.getState().resetClimate();
}

function todayMonthDays(yearsBack: number[]): {
  times: string[];
  temps: number[];
} {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const times: string[] = [];
  const temps: number[] = [];
  for (const back of yearsBack) {
    times.push(`${now.getFullYear() - back}-${mm}-${dd}`);
    temps.push(10);
  }
  return { times, temps };
}

beforeEach(() => {
  resetStore();
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ClimateView (2D)', () => {
  it('shows the statement, widget titles and attribution links immediately', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Promise(() => {})),
    ); // never resolves
    render(<ClimateView />);
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Our Climate, Our Future',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/For almost 10 years I have reduced my consumption/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Is Today Weirdly Hot/Cold?',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open-Meteo.com' }),
    ).toHaveAttribute('href', 'https://open-meteo.com/');
    expect(
      screen.getByRole('link', { name: 'Climate Defense Fund of Ontario' }),
    ).toHaveAttribute(
      'href',
      'https://www.climatesolutions.ca/climate-defense-fund-ontario',
    );
  });

  it('renders live comparison when the API succeeds', async () => {
    const { times, temps } = todayMonthDays([1, 2, 3]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.startsWith('https://api.open-meteo.com')) {
          return {
            ok: true,
            json: async () => ({ current_weather: { temperature: 25 } }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            daily: { time: times, temperature_2m_mean: temps },
          }),
        } as Response;
      }),
    );

    render(<ClimateView />);
    expect(
      await screen.findByText(/Current temperature in/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Toronto, Canada/)).toBeInTheDocument();
    expect(screen.getByText('25.0°C')).toBeInTheDocument();
    expect(screen.getByText('10.0°C')).toBeInTheDocument();
    // +15.0°C hotter, 🔥 emoji (>5)
    expect(screen.getByText('+15.0°C')).toBeInTheDocument();
    expect(screen.getByText(/hotter/)).toBeInTheDocument();
    // heatmap appears with the year selector and legend
    expect(screen.getByLabelText('Select Year')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Historical weather heatmap/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Hottest day on record')).toBeInTheDocument();
  });

  it('falls back to the bundled snapshot on API failure', async () => {
    const { times, temps } = todayMonthDays([1, 2, 3]);
    const flat: Record<string, number> = {};
    times.forEach((t, i) => {
      flat[t] = temps[i]!;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.includes('climate-snapshot.json')) {
          return {
            ok: true,
            json: async () => ({ generatedAt: 'test', flat }),
          } as Response;
        }
        throw new Error('network down');
      }),
    );

    render(<ClimateView />);
    expect(
      await screen.findByText(/bundled historical snapshot/),
    ).toBeInTheDocument();
    expect(screen.getByText(/bundled snapshot/)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Historical weather heatmap/ }),
    ).toBeInTheDocument();
  });

  it('shows the graceful unavailable plaque when everything fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    render(<ClimateView />);
    const plaques = await screen.findAllByText(CLIMATE_UNAVAILABLE_MESSAGE);
    expect(plaques.length).toBeGreaterThanOrEqual(2); // widget + heatmap
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('changes the heatmap year via the selector', async () => {
    const user = userEvent.setup();
    const { times, temps } = todayMonthDays([1, 2, 3]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.startsWith('https://api.open-meteo.com')) {
          return {
            ok: true,
            json: async () => ({ current_weather: { temperature: 25 } }),
          } as Response;
        }
        if (url.startsWith('https://archive-api.open-meteo.com')) {
          return {
            ok: true,
            json: async () => ({
              daily: { time: times, temperature_2m_mean: temps },
            }),
          } as Response;
        }
        throw new Error(`unexpected ${url}`);
      }),
    );

    render(<ClimateView />);
    const select = await screen.findByLabelText('Select Year');
    await user.selectOptions(select, '2024');
    expect(select).toHaveValue('2024');
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: /Historical Weather Heatmap for 2024/,
      }),
    ).toBeInTheDocument();
  });
});
