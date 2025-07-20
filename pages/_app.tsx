import type { AppProps } from 'next/app';
import { MantineProvider, createTheme, ColorScheme } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import '@mantine/core/styles.css';
import '../styles/global.css';
import React from 'react';
import { ColorSchemeToggle } from '../components/ColourSchemeToggle';
import { TagProvider } from '../contexts/TagContext';

const theme = createTheme({
  colors: {
    'purple-primary': [
      '#F3E5F5',
      '#E1BEE7',
      '#CE93D8',
      '#BA68C8',
      '#9C27B0',
      '#8E24AA',
      '#7B1FA2',
      '#6A1B9A',
      '#4A148C',
      '#311B92',
    ],
  },
  primaryColor: 'purple-primary',
  autoContrast: true,
  white: '#f3e5ffff',
  black: '#090225ff',
});

export default function App({ Component, pageProps }: AppProps) {
  const [colorScheme] = useLocalStorage<ColorScheme>({
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
