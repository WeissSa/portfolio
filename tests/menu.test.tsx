import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { usePortfolioStore } from '../src/state/store';

describe('P5 main menu', () => {
  it('lists all zones plus GitHub/LinkedIn contact links', () => {
    render(<App />);
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    for (const label of [
      'Home',
      'About',
      'Experience',
      'Projects',
      'Climate',
    ]) {
      expect(within(menu).getByRole('link', { name: label })).toHaveAttribute(
        'href',
        `#${label === 'Home' ? '/' : `/${label.toLowerCase()}`}`,
      );
    }
    expect(within(menu).getByRole('link', { name: /GitHub/ })).toHaveAttribute(
      'href',
      'https://github.com/WeissSa',
    );
    expect(
      within(menu).getByRole('link', { name: /LinkedIn/ }),
    ).toHaveAttribute('href', 'https://linkedin.com/in/samuelbsweiss');
  });

  it('marks the active zone with aria-current', () => {
    window.location.hash = '#/climate';
    render(<App />);
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    expect(within(menu).getByRole('link', { name: 'Climate' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('moves focus with arrow keys and wraps around', async () => {
    const user = userEvent.setup();
    render(<App />);
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    const about = within(menu).getByRole('link', { name: 'About' });
    about.focus();

    await user.keyboard('{ArrowDown}');
    expect(
      within(menu).getByRole('link', { name: 'Experience' }),
    ).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(about).toHaveFocus();

    await user.keyboard('{ArrowUp}'); // index 0 → Home
    expect(within(menu).getByRole('link', { name: 'Home' })).toHaveFocus();

    await user.keyboard('{ArrowUp}'); // wraps to last item
    expect(within(menu).getByRole('link', { name: 'Climate' })).toHaveFocus();

    await user.keyboard('{Home}');
    expect(within(menu).getByRole('link', { name: 'Home' })).toHaveFocus();

    await user.keyboard('{End}');
    expect(within(menu).getByRole('link', { name: 'Climate' })).toHaveFocus();
  });

  it('syncs keyboard focus to the canonical in-world highlight', () => {
    render(<App />);
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    const climate = within(menu).getByRole('link', { name: 'Climate' });
    act(() => climate.focus());
    expect(usePortfolioStore.getState().menuFocusRoute).toBe('/climate');
    expect(climate).toHaveClass('p5-btn--diegetic-highlight');
    act(() => climate.blur());
    expect(usePortfolioStore.getState().menuFocusRoute).toBeNull();
    expect(climate).not.toHaveClass('p5-btn--diegetic-highlight');
  });

  it('mirrors an in-world hover on the DOM twin link', () => {
    render(<App />);
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    const about = within(menu).getByRole('link', { name: 'About' });
    expect(about).not.toHaveClass('p5-btn--diegetic-highlight');
    act(() => usePortfolioStore.getState().setMenuHoverRoute('/about'));
    expect(about).toHaveClass('p5-btn--diegetic-highlight');
    act(() => usePortfolioStore.getState().setMenuHoverRoute(null));
    expect(about).not.toHaveClass('p5-btn--diegetic-highlight');
  });

  it('activates a zone with Enter and deep-links the hash route', async () => {
    const user = userEvent.setup();
    render(<App />);
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    const experience = within(menu).getByRole('link', {
      name: 'Experience',
    });
    experience.focus();
    await user.keyboard('{Enter}');
    expect(window.location.hash).toBe('#/experience');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Experience' }),
    ).toBeInTheDocument();
  });
});
