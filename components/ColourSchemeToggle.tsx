import { ActionIcon, useMantineColorScheme } from '@mantine/core';
import { IconMoonStars, IconSun } from '@tabler/icons-react';
import React from 'react';

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
      style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}
    >
      {colorScheme === 'dark' ? (
        <IconSun size="1.2rem" />
      ) : (
        <IconMoonStars size="1.2rem" />
      )}
    </ActionIcon>
  );
};
