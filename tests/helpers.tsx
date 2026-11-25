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

/** Minimal 2D context for in-world DetailPlane textures in jsdom (the global
 *  setup stub returns null, which makes DetailPlane render nothing). */
export function fakeDetail2dContext(): CanvasRenderingContext2D {
  const noop = () => {};
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textBaseline: 'top',
    textAlign: 'left',
    font: '',
    fillRect: noop,
    strokeRect: noop,
    fillText: noop,
  } as unknown as CanvasRenderingContext2D;
}
