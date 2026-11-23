/**
 * Shared test helpers. Mantine components do NOT throw without a
 * MantineProvider — but they render with the default (unthemed) theme, so any
 * test that renders a component directly — instead of <App/>, which mounts the
 * provider itself — renders through `renderWithProviders` for theme parity
 * with the app (same themed provider, forced dark scheme).
 */
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MantineProvider } from '@mantine/core';
import { mantineTheme } from '../src/styles/mantine-theme';

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(
    <MantineProvider theme={mantineTheme} forceColorScheme="dark">
      {ui}
    </MantineProvider>,
    options,
  );
}
