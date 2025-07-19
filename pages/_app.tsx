import type { AppProps } from 'next/app';
import {
  MantineProvider,
  createTheme,
  ActionIcon,
  useMantineColorScheme,
  ColorScheme,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { IconSun, IconMoonStars } from '@tabler/icons-react';
import '@mantine/core/styles.css';
import '../styles/global.css';
import React from 'react';

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
    <MantineProvider theme={theme} defaultColorScheme={colorScheme}>
      <Component {...pageProps} />
      <ColorSchemeToggle />
    </MantineProvider>
  );
}

const ColorSchemeToggle = () => {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <ActionIcon
      onClick={() => toggleColorScheme()}
      variant="default"
      size="xl"
      style={{ position: 'fixed', bottom: 20, right: 20 }}
    >
      {colorScheme === 'dark' ? (
        <IconSun size="1.2rem" />
      ) : (
        <IconMoonStars size="1.2rem" />
      )}
    </ActionIcon>
  );
};
