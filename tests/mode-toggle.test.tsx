/**
 * 2D/3D toggle behaviour (REWORK_PLAN §3.7, commit 5): keyboard-clickable
 * native button, aria-pressed state, persisted override, polite live
 * announcement, and the store's authoritative 2D default.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MODE_STORAGE_KEY } from '../src/lib/device-tier';
import { usePortfolioStore } from '../src/state/store';
import { ModeToggle } from '../src/ui/ModeToggle';

describe('ModeToggle', () => {
  it('is a keyboard-operable pressed button that starts in 2D', async () => {
    const user = userEvent.setup();
    usePortfolioStore.setState({ mode: '2d' });
    render(<ModeToggle />);

    const button = screen.getByRole('button', { name: '3D room mode' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('2D mode enabled')).toBeInTheDocument();

    button.focus();
    await user.keyboard('{Enter}');
    expect(usePortfolioStore.getState().mode).toBe('3d');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('3D room mode enabled')).toBeInTheDocument();
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('3d');

    await user.keyboard(' ');
    expect(usePortfolioStore.getState().mode).toBe('2d');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('2d');
  });

  it('writes an override that outlives the component', async () => {
    const user = userEvent.setup();
    usePortfolioStore.setState({ mode: '2d' });
    const { unmount } = render(<ModeToggle />);
    await user.click(screen.getByRole('button', { name: '3D room mode' }));
    unmount();

    // Persistence is external to the store (survives remount/reload).
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('3d');
    expect(usePortfolioStore.getState().mode).toBe('3d');
  });
});
