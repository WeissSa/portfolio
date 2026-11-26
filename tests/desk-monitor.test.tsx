/**
 * Desk monitor + desktop zoom (REWORK_PLAN §3.2.2 / commit 7). Headless and
 * structural only: R3F picking writes the store flag, the SAME AboutDesktop
 * DOM renders full-screen, Esc/close return to the room, focus is managed, and
 * 2D `#/about` stays authoritative. No pixel verification — appearance needs a
 * real browser (§6 screenshot review).
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import App from '../src/App';
import { createMonitor } from '../src/scene/art/geometry';
import {
  createRoomMaterials,
  disposeRoomMaterials,
} from '../src/scene/art/materials';
import { DeskZone } from '../src/scene/zones/Desk';
import { usePortfolioStore } from '../src/state/store';

// jsdom has no WebGL2: stub the lazy scene so forcing 3D mode never tries to
// create a Canvas (capability gates + error boundary have their own tests).
vi.mock('../src/ui/SceneLayer', () => ({
  SceneLayer: () => <div data-testid="scene-stub" />,
}));

beforeEach(() => {
  window.location.hash = '#/';
  usePortfolioStore.setState({
    mode: '2d',
    desktopOpen: false,
    selectedPostId: null,
    hoveredPostId: null,
    openWindows: [],
  });
  document.body.style.cursor = '';
});

function openZoom() {
  render(<App />);
  act(() => {
    usePortfolioStore.setState({
      mode: '3d',
      desktopOpen: true,
      openWindows: [],
    });
  });
  return document.querySelector('.detail-mirror') as HTMLElement;
}

describe('desk monitor picking (headless, structural)', () => {
  it('clicking the monitor opens the desktop and reuses room-owned art', async () => {
    const materials = createRoomMaterials({ monitor: new THREE.Texture() });
    const monitor = createMonitor('desk-test');
    const renderer = await ReactThreeTestRenderer.create(
      <DeskZone monitor={monitor} materials={materials} />,
      { frameloop: 'never' },
    );
    const group = renderer.scene.find(
      (node) => node.props.name === 'desk-monitor',
    );
    expect(group).toBeDefined();
    const meshes = renderer.scene.findAll((node) => node.type === 'Mesh');
    expect(meshes).toHaveLength(monitor.length); // bezel, screen, stand…
    // No new GPU resources: geometry + material come from the room pipeline.
    expect((meshes[0]!.instance as THREE.Mesh).geometry).toBe(
      monitor[0]!.geometry,
    );
    expect((meshes[0]!.instance as THREE.Mesh).material).toBe(
      materials[monitor[0]!.material],
    );

    const stopPropagation = vi.fn();
    act(() => group!.props.onClick({ stopPropagation }));
    expect(usePortfolioStore.getState().desktopOpen).toBe(true);
    expect(stopPropagation).toHaveBeenCalledTimes(1);

    act(() => group!.props.onPointerOver({ stopPropagation }));
    expect(document.body.style.cursor).toBe('pointer');
    act(() => group!.props.onPointerOut({ stopPropagation }));
    expect(document.body.style.cursor).toBe('');

    await renderer.unmount();
    monitor.forEach((part) => part.geometry.dispose());
    disposeRoomMaterials(materials);
  });
});

describe('desktop zoom DOM (3D)', () => {
  it('renders the full-screen About desktop with an accessible announcement', () => {
    const zoom = openZoom();
    expect(zoom).toHaveAttribute('role', 'dialog');
    expect(zoom).toHaveAttribute('aria-modal', 'true');
    for (const label of ['Bio', 'Now', 'Hobbies', 'Skills', 'Links']) {
      expect(
        within(zoom).getByRole('button', { name: new RegExp(label) }),
      ).toBeInTheDocument();
    }
    expect(within(zoom).getByText(/About desktop opened/)).toBeInTheDocument();
  });

  it('Escape closes the top window first, then returns to the room', async () => {
    const user = userEvent.setup();
    const zoom = openZoom();
    await user.click(within(zoom).getByRole('button', { name: /Bio/ }));
    expect(
      within(zoom).getByRole('dialog', { name: 'Bio window' }),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(usePortfolioStore.getState().desktopOpen).toBe(true);
    expect(
      within(zoom).queryByRole('dialog', { name: 'Bio window' }),
    ).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(usePortfolioStore.getState().desktopOpen).toBe(false);
    expect(document.querySelector('.detail-mirror')).not.toBeInTheDocument();
  });

  it('the close button returns to the room', async () => {
    const user = userEvent.setup();
    openZoom();
    await user.click(
      screen.getByRole('button', {
        name: 'Close desktop and return to the room',
      }),
    );
    expect(usePortfolioStore.getState().desktopOpen).toBe(false);
    expect(document.querySelector('.detail-mirror')).not.toBeInTheDocument();
  });

  it('traps focus on entry and restores it on exit', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const zoom = openZoom();
    await waitFor(() =>
      expect(
        within(zoom).getByRole('button', {
          name: 'Close desktop and return to the room',
        }),
      ).toHaveFocus(),
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });
});

describe('2D About stays authoritative', () => {
  it('keeps #/about keyboard-accessible even if desktopOpen leaked true', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/about';
    render(<App />);
    act(() => {
      usePortfolioStore.setState({ desktopOpen: true, mode: '2d' });
    });

    // The zoom is 3D-only; a stale flag cannot double-render the About zone.
    expect(document.querySelector('.detail-mirror')).not.toBeInTheDocument();
    const bio = screen.getByRole('button', { name: /Bio/ });
    bio.focus();
    await user.keyboard('{Enter}');
    expect(
      screen.getByRole('dialog', { name: 'Bio window' }),
    ).toBeInTheDocument();
  });
});

describe('UX fix: no clipped painted CRT plane', () => {
  it('keeps the readable About content in the DOM panel, never a clipped 3D card', async () => {
    const materials = createRoomMaterials({ monitor: new THREE.Texture() });
    const monitor = createMonitor('crt-detail-gate');
    try {
      act(() =>
        usePortfolioStore.setState({
          mode: '3d',
          sceneReady: true,
          pointerFine: true,
          desktopOpen: true,
        }),
      );
      const renderer = await ReactThreeTestRenderer.create(
        <DeskZone monitor={monitor} materials={materials} />,
        { frameloop: 'never' },
      );
      const painted = () =>
        renderer.scene.findAll(
          (node) => node.props.name === 'crt-detail-screen',
        );
      expect(painted()).toHaveLength(0);
      await renderer.unmount();
    } finally {
      disposeRoomMaterials(materials);
    }
  });
});
