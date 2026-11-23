/**
 * Shared test helpers. Mantine v9 REQUIRES a MantineProvider in the tree
 * (components throw without one), so any test that renders a component
 * directly — instead of <App/>, which mounts the provider itself — renders
 * through `renderWithProviders` to get the same themed provider the app uses.
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
