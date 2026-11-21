import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../src/App';

describe('App shell (commit 1 skeleton)', () => {
  it('renders the headline and main navigation', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Sam Weiss' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /main/i })).toHaveTextContent(
      'Climate',
    );
    expect(
      screen.getByText('SWE @ Gusto | HBSc in CS from UofT'),
    ).toBeVisible();
  });

  it('navigates via hash links', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('link', { name: 'Climate' }));
    expect(window.location.hash).toBe('#/climate');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Climate' }),
    ).toBeInTheDocument();
  });

  it('exposes a skip link targeting the main content', () => {
    render(<App />);
    const skip = screen.getByRole('link', { name: /skip to content/i });
    expect(skip).toHaveAttribute('href', '#main');
    expect(skip).toHaveTextContent('Skip to content');
  });
});
