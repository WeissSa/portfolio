/**
 * Mode selector behaviour (REWORK_PLAN §3.7, commit 5): keyboard-clickable
 * native buttons, aria-pressed state, persisted override, polite live
 * announcement, an "Auto" recovery option and a capability-gated 3D option.
 */
import { screen } from '@testing-library/react';
import { renderWithProviders } from './helpers';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MODE_STORAGE_KEY,
  REDUCED_MOTION_OPTIN_KEY,
  readReducedMotionOptIn,
  writeReducedMotionOptIn,
} from '../src/lib/device-tier';
import { usePortfolioStore } from '../src/state/store';
import { ModeToggle } from '../src/ui/ModeToggle';

describe('ModeToggle', () => {
  beforeEach(() => {
    // Capable device by default so the 3D option is offered.
    usePortfolioStore.setState({ mode: '2d', autoMode: '3d' });
  });

  it('is a keyboard-operable pressed button that starts in 2D', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModeToggle />);

    const button = screen.getByRole('button', { name: '3D view' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Standard view on')).toBeInTheDocument();

    button.focus();
    await user.keyboard('{Enter}');
    expect(usePortfolioStore.getState().mode).toBe('3d');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('3D view on')).toBeInTheDocument();
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('3d');

    await user.keyboard(' ');
    expect(usePortfolioStore.getState().mode).toBe('2d');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('2d');
  });

  it('writes an override that outlives the component', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<ModeToggle />);
    await user.click(screen.getByRole('button', { name: '3D view' }));
    unmount();

    // Persistence is external to the store (survives remount/reload).
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('3d');
    expect(usePortfolioStore.getState().mode).toBe('3d');
  });

  it('offers Auto to clear a stuck override and restore the auto mode', async () => {
    const user = userEvent.setup();
    usePortfolioStore.setState({ mode: '3d', autoMode: '2d' });
    localStorage.setItem(MODE_STORAGE_KEY, '3d');
    renderWithProviders(<ModeToggle />);

    await user.click(screen.getByRole('button', { name: 'Auto' }));
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBeNull();
    expect(usePortfolioStore.getState().mode).toBe('2d');
  });

  it('Auto after a reduced-motion opt-in returns to the capability-derived 2D mode', async () => {
    const user = userEvent.setup();
    usePortfolioStore.setState({
      mode: '3d',
      autoMode: '2d',
      reducedMotionOptIn: true,
      reducedMotionOptInAvailable: true,
    });
    writeReducedMotionOptIn(true);
    renderWithProviders(<ModeToggle />);

    await user.click(screen.getByRole('button', { name: 'Auto' }));
    expect(usePortfolioStore.getState().mode).toBe('2d');
    expect(usePortfolioStore.getState().reducedMotionOptIn).toBe(false);
    expect(readReducedMotionOptIn()).toBe(false);
    expect(localStorage.getItem(REDUCED_MOTION_OPTIN_KEY)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Reduced motion view' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('Static 3D and Auto keep aria-pressed consistent for sighted users', async () => {
    const user = userEvent.setup();
    usePortfolioStore.setState({
      mode: '2d',
      autoMode: '2d',
      reducedMotionOptIn: false,
      reducedMotionOptInAvailable: true,
    });
    renderWithProviders(<ModeToggle />);
    const static3d = screen.getByRole('button', {
      name: 'Reduced motion view',
    });
    const threeD = screen.getByRole('button', { name: '3D view' });
    expect(static3d).toHaveAttribute('aria-pressed', 'false');
    expect(threeD).toHaveAttribute('aria-pressed', 'false');

    await user.click(static3d);
    expect(static3d).toHaveAttribute('aria-pressed', 'true');
    expect(threeD).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem(REDUCED_MOTION_OPTIN_KEY)).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Auto' }));
    expect(static3d).toHaveAttribute('aria-pressed', 'false');
    expect(threeD).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables 3D with an explanation when capabilities forbid it', async () => {
    const user = userEvent.setup();
    usePortfolioStore.setState({ mode: '2d', autoMode: '2d' });
    renderWithProviders(<ModeToggle />);

    const button = screen.getByRole('button', { name: '3D view' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-describedby', 'mode-3d-unavailable');
    expect(
      screen.getByText(/3D view is not available on this device/),
    ).toBeInTheDocument();

    await user.click(button);
    expect(usePortfolioStore.getState().mode).toBe('2d');
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBeNull();

    // Auto still works and cannot re-enable 3D on an incapable device.
    await user.click(screen.getByRole('button', { name: 'Auto' }));
    expect(usePortfolioStore.getState().mode).toBe('2d');
  });
});
