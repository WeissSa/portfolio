import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ScrollDownArrow } from './ScrollDownArrow';
import React from 'react';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

describe('ScrollDownArrow', () => {
  it('renders the chevron down icon', () => {
    render(
      <MantineProvider>
        <ScrollDownArrow />
      </MantineProvider>
    );

    // Check if the IconChevronDown is rendered. It doesn't have a direct text, so we check its role or testId if available.
    // For simplicity, we'll check for its presence by looking for a common SVG attribute or its title if it has one.
    // A more robust test might involve snapshot testing or checking for specific SVG paths.
    const iconElement = screen.getByTestId('scroll-down-icon');
    expect(iconElement).toBeInTheDocument();
  });
});
