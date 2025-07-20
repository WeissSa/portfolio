import { useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

export const useIsMobile = () => {
  const theme = useMantineTheme();
  return {
    isMobile: () => useMediaQuery(`(max-width: ${theme.breakpoints.lg})`),
  };
};
