import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../src/App';

describe('App shell', () => {
  it('renders identity, headline and main menu', () => {
    render(<App />);
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    expect(menu).toBeInTheDocument();
    expect(within(menu).getByText('Sam Weiss')).toBeVisible();
    expect(
      within(menu).getByText('SWE @ Gusto | HBSc in CS from UofT'),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Sam Weiss' }),
    ).toBeInTheDocument();
  });

  it('navigates via hash links', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('link', { name: 'Climate' }));
    expect(window.location.hash).toBe('#/climate');
    expect(
      await screen.findByRole('heading', { level: 2, name: /Climate/i }),
    ).toBeInTheDocument();
    // Wait for the (globally stubbed) loadClimate effect to settle so its
    // state update cannot land after this test has finished.
    expect(
      await screen.findByText(/Data source: live Open-Meteo/),
    ).toBeInTheDocument();
  });

  it('exposes a skip link targeting the main content', () => {
    render(<App />);
    const skip = screen.getByRole('link', { name: /skip to content/i });
    expect(skip).toHaveAttribute('href', '#main');
  });

  it('announces the active zone to screen readers', () => {
    window.location.hash = '#/projects';
    render(<App />);
    expect(screen.getByText('Projects zone selected')).toBeInTheDocument();
  });
});
