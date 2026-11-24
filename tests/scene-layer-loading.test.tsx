/**
 * Loading-indicator visibility regression (Medium review finding): the
 * "Loading the room…" cut-in used to live inside `.scene-layer`, which is
 * opacity:0 until the Canvas is ready, so it was invisible during the load it
 * was meant to announce. It must be a sibling of the faded wrapper.
 */
import { screen } from '@testing-library/react';
import { renderWithProviders } from './helpers';
import { describe, expect, it, vi } from 'vitest';
import { SceneLayer } from '../src/ui/SceneLayer';

// A module factory that never resolves keeps React.lazy suspended, so the
// Suspense fallback stays on screen for the whole test (no late act warnings).
vi.mock('../src/scene/Room', () => new Promise(() => {}));

describe('SceneLayer loading fallback', () => {
  it('renders the indicator visibly, outside the opacity-faded wrapper', () => {
    renderWithProviders(<SceneLayer quality="mobile" />);

    const loading = screen.getByText(/Loading the room/);
    expect(loading).toBeInTheDocument();
    expect(loading.closest('.scene-layer')).toBeNull();
    // Its own fixed, above-the-shell portal is independent of opacity:0.
    expect(loading.closest('.scene-loading-portal')).not.toBeNull();
    // The polite live region still announces the load to screen readers.
    expect(screen.getByText('Loading the 3D room')).toBeInTheDocument();
  });
});

describe('SceneLayer mobile grade parity (art-overhaul commit 3b)', () => {
  it('renders the CSS grade overlay for the mobile tier, hidden until ready', () => {
    renderWithProviders(<SceneLayer quality="mobile" />);
    const overlay = screen.getByTestId('scene-grade-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
    // Room is mocked as never-resolving, so the layer is still loading: the
    // overlay must NOT be faded in before the canvas it grades exists.
    expect(overlay.className).not.toContain('scene-grade-overlay--ready');
    expect(overlay.className).toContain('scene-grade-overlay');
  });

  it('renders the overlay for the low tier too (no GLSL pass there either)', () => {
    renderWithProviders(<SceneLayer quality="low" />);
    expect(screen.getByTestId('scene-grade-overlay')).toBeInTheDocument();
  });

  it('renders NO overlay on desktop — the GLSL painterly pass grades there', () => {
    renderWithProviders(<SceneLayer quality="desktop" />);
    expect(screen.queryByTestId('scene-grade-overlay')).toBeNull();
  });
});
