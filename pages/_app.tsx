import type { AppProps } from 'next/app';
import { MantineProvider, createTheme, MantineColorScheme } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import '@mantine/core/styles.css';
import '../styles/global.css';
import React from 'react';
import { ColorSchemeToggle } from '../components/ColourSchemeToggle';
import { TagProvider } from '../contexts/TagContext';

import { PURPLE_PRIMARY_COLORS, WHITE_COLOR, BLACK_COLOR } from '../constants/theme';

const theme = createTheme({
  colors: {
    'purple-primary': PURPLE_PRIMARY_COLORS,
  },
  primaryColor: 'purple-primary',
  autoContrast: true,
  white: WHITE_COLOR,
  black: BLACK_COLOR,
});

export default function App({ Component, pageProps }: AppProps) {
  const [colorScheme] = useLocalStorage<MantineColorScheme>({
    key: 'mantine-color-scheme',
    defaultValue: 'dark',
    getInitialValueInEffect: true,
  });

  return (
    <TagProvider>
      <MantineProvider theme={theme} defaultColorScheme={colorScheme}>
        <Component {...pageProps} />
        <ColorSchemeToggle />
      </MantineProvider>
    </TagProvider>
  );
}
