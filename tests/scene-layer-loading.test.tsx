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
