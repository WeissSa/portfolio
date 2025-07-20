import { ActionIcon, useMantineColorScheme } from '@mantine/core';
import { IconMoonStars, IconSun } from '@tabler/icons-react';
import React from 'react';
import classes from './ColourSchemeToggle.module.css';

export const ColorSchemeToggle = () => {
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
      aria-label="Toggle color scheme"
      className={classes.colorSchemeToggle}
    >
      {colorScheme === 'dark' ? (
        <IconSun size="1.2rem" />
      ) : (
        <IconMoonStars size="1.2rem" />
      )}
    </ActionIcon>
  );
};
