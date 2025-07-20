import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { WelcomeSection } from './WelcomeSection';
import React from 'react';

jest.mock('./ScrollDownArrow', () => ({
  ScrollDownArrow: () => <div>Mocked ScrollDownArrow</div>,
}));

describe('WelcomeSection', () => {
  it('renders the welcome message and description', () => {
    render(
      <MantineProvider>
        <WelcomeSection />
      </MantineProvider>,
    );

    expect(screen.getByText('Welcome to my Website!')).toBeInTheDocument();
    expect(screen.getByText(/I'm Sam/)).toBeInTheDocument();
    expect(screen.getByText('Mocked ScrollDownArrow')).toBeInTheDocument();
  });
});
