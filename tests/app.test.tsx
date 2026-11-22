import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { MODE_STORAGE_KEY } from '../src/lib/device-tier';
import { usePortfolioStore } from '../src/state/store';

// jsdom has no WebGL2; stub the lazy scene so a capable-device default into 3D
// never tries to create a real Canvas (the real gate is tested in device-tier).
vi.mock('../src/ui/SceneLayer', () => ({
  SceneLayer: () => <div data-testid="scene-stub" />,
}));

type Pointer = 'fine' | 'coarse';

/** Present a capable (or deliberately constrained) device to detectCapabilities. */
function stubCapabilities({
  webgl2 = true,
  pointer = 'fine',
  reducedMotion = false,
}: {
  webgl2?: boolean;
  pointer?: Pointer;
  reducedMotion?: boolean;
} = {}): void {
  const loseContext = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    webgl2
      ? ({
          getExtension: () => ({ loseContext }),
        } as unknown as WebGL2RenderingContext)
      : null,
  );
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    const matches = query.includes('prefers-reduced-motion')
      ? reducedMotion
      : query.includes('(pointer: coarse)')
        ? pointer === 'coarse'
        : query.includes('(pointer: fine)')
          ? pointer === 'fine'
          : false;
    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
  });
}

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

describe('3D-by-default on capable devices (owner decision)', () => {
  beforeEach(() => {
    // Restore capability spies from the previous test while nothing is mounted.
    vi.restoreAllMocks();
    window.location.hash = '';
    usePortfolioStore.setState({
      mode: '2d',
      autoMode: '2d',
      activeZone: '/',
      hasNavigated: false,
      desktopOpen: false,
      openWindows: [],
    });
  });

  it('a capable desktop enters 3D after first paint, keeping the 2D-first shell', async () => {
    stubCapabilities();
    render(<App />);

    await waitFor(() => expect(usePortfolioStore.getState().mode).toBe('3d'));
    expect(usePortfolioStore.getState().autoMode).toBe('3d');
    expect(screen.getByTestId('scene-stub')).toBeInTheDocument();
    // The shell painted FIRST: app-initial is still on the fully-visible DOM,
    // so the canvas fade-in cannot cause an opacity-0 frame-0 content jump.
    const shell = screen.getByRole('link', { name: /skip to content/i })
      .parentElement as HTMLElement;
    expect(shell).toHaveClass('app-3d', 'app-initial');
    expect(usePortfolioStore.getState().hasNavigated).toBe(false);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Sam Weiss' }),
    ).toBeVisible();
  });

  it('a capable mobile (coarse pointer) also defaults into 3D', async () => {
    stubCapabilities({ pointer: 'coarse' });
    render(<App />);

    await waitFor(() => expect(usePortfolioStore.getState().mode).toBe('3d'));
    expect(usePortfolioStore.getState().autoMode).toBe('3d');
    expect(screen.getByTestId('scene-stub')).toBeInTheDocument();
  });

  it('the reduced-motion gate still forces 2D on otherwise capable hardware', async () => {
    stubCapabilities({ reducedMotion: true });
    render(<App />);

    await waitFor(() => expect(usePortfolioStore.getState().mode).toBe('2d'));
    expect(usePortfolioStore.getState().autoMode).toBe('2d');
    expect(screen.queryByTestId('scene-stub')).not.toBeInTheDocument();
  });

  it('a manual 2D override wins; Auto restores the desktop 3D default', async () => {
    stubCapabilities();
    localStorage.setItem(MODE_STORAGE_KEY, '2d');
    render(<App />);

    await waitFor(() => expect(usePortfolioStore.getState().mode).toBe('2d'));
    expect(screen.queryByTestId('scene-stub')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Automatic mode' }));
    expect(usePortfolioStore.getState().mode).toBe('3d');
    expect(screen.getByTestId('scene-stub')).toBeInTheDocument();
  });

  it('renders exactly one AboutDesktop in 3D /about with the monitor zoom open', async () => {
    stubCapabilities();
    window.location.hash = '#/about';
    act(() => {
      usePortfolioStore.setState({
        mode: '3d',
        autoMode: '3d',
        openWindows: [],
      });
      usePortfolioStore.getState().openDesktop();
    });
    render(<App />);

    await waitFor(() => expect(usePortfolioStore.getState().mode).toBe('3d'));
    expect(screen.getAllByRole('button', { name: /Bio/ })).toHaveLength(1);
    expect(document.querySelectorAll('#about-icon-bio')).toHaveLength(1);
    expect(document.querySelectorAll('#about-heading')).toHaveLength(1);

    // One Escape closes only the top window (a duplicate instance would run a
    // second document handler and close both).
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Bio/ }));
    await screen.findByRole('dialog', { name: 'Bio window' });
    await user.click(screen.getByRole('button', { name: /Now/ }));
    await screen.findByRole('dialog', { name: 'Now window' });
    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('dialog', { name: 'Now window' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'Bio window' }),
    ).toBeInTheDocument();
  });
});
