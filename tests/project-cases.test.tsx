/**
 * Game cases — Projects (REWORK_PLAN §3.2.3 / §4.8, commit 8): picking →
 * selection → the SAME DOM PostCard detail dialog used in 2D, external repo
 * links + accessible tags, 3D→2d selection clearing, focus management and the
 * keyboard-operable DOM equivalent. R3F tests are structural only — no pixel
 * verification (appearance needs a real browser screenshot review).
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import App from '../src/App';
import { PROJECTS, displayTags, postId } from '../src/content/posts';
import { createGameCases } from '../src/scene/art/geometry';
import {
  createRoomMaterials,
  disposeRoomMaterials,
  type RoomMaterials,
} from '../src/scene/art/materials';
import { ProjectCases } from '../src/scene/zones/ProjectCases';
import { usePortfolioStore } from '../src/state/store';

// jsdom has no WebGL2: stub the lazy scene so forcing 3D mode never creates a
// Canvas (capability gates + error boundary have their own tests).
vi.mock('../src/ui/SceneLayer', () => ({
  SceneLayer: () => <div data-testid="scene-stub" />,
}));

const cases = createGameCases('project-test', PROJECTS.length);
const first = PROJECTS[0]!;
const firstId = postId(first);
const publicProject = PROJECTS.find((project) => project.repoUrl)!;

beforeEach(() => {
  window.location.hash = '#/projects';
  usePortfolioStore.setState({
    mode: '2d',
    selectedPostId: null,
    hoveredPostId: null,
    selectedProjectId: null,
    hoveredProjectId: null,
    desktopOpen: false,
  });
  document.body.style.cursor = '';
});

function renderProjects() {
  window.location.hash = '#/projects';
  render(<App />);
  return document.getElementById('main') as HTMLElement;
}

describe('game-case geometry (headless)', () => {
  it('lays out five distinct, ordered pick targets on the shelf', () => {
    const bodies = cases.filter((part) => part.id.startsWith('case-body-'));
    expect(bodies).toHaveLength(PROJECTS.length);
    const xs = bodies.map((part) => part.position![0]);
    expect(new Set(xs.map((x) => Math.round(x * 100))).size).toBe(5);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.5);
  });
});

describe('R3F case zone (headless, structural)', () => {
  let materials: RoomMaterials;

  beforeEach(() => {
    materials = createRoomMaterials({});
  });

  it('clicking a case writes its project id and stops propagation', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ProjectCases cases={cases} materials={materials} />,
      { frameloop: 'never' },
    );
    const group = renderer.scene.find(
      (node) => node.props.name === `game-case-${firstId}`,
    );
    expect(group).toBeDefined();

    const stopPropagation = vi.fn();
    act(() => group!.props.onClick({ stopPropagation }));
    expect(usePortfolioStore.getState().selectedProjectId).toBe(firstId);
    expect(stopPropagation).toHaveBeenCalledTimes(1);

    await renderer.unmount();
    disposeRoomMaterials(materials);
  });

  it('hover sets the store id + pointer cursor; out clears both', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ProjectCases cases={cases} materials={materials} />,
      { frameloop: 'never' },
    );
    const group = renderer.scene.find(
      (node) => node.props.name === `game-case-${firstId}`,
    )!;
    const stopPropagation = vi.fn();

    act(() => group.props.onPointerOver({ stopPropagation }));
    expect(usePortfolioStore.getState().hoveredProjectId).toBe(firstId);
    expect(document.body.style.cursor).toBe('pointer');
    expect(stopPropagation).toHaveBeenCalled();

    act(() => group.props.onPointerOut({ stopPropagation }));
    expect(usePortfolioStore.getState().hoveredProjectId).toBeNull();
    expect(document.body.style.cursor).toBe('');

    await renderer.unmount();
    disposeRoomMaterials(materials);
  });

  it('opens the selected lid with a damped lift + tilt (no per-frame objects)', async () => {
    const lidPart = cases.find((part) => part.id === `case-lid-0`)!;
    const renderer = await ReactThreeTestRenderer.create(
      <ProjectCases cases={cases} materials={materials} />,
      { frameloop: 'never' },
    );
    const lidGroup = renderer.scene.find(
      (node) =>
        node.type === 'Group' && node.props.position === lidPart.position,
    );
    expect(lidGroup).toBeDefined();
    const group = lidGroup!.instance as THREE.Group;
    expect(group.rotation.x).toBe(0);
    expect(group.position.y).toBeCloseTo(lidPart.position![1], 6);

    act(() => usePortfolioStore.getState().selectProject(firstId));
    await renderer.advanceFrames(20, 0.05);
    // Selected: the lid has lifted and hinged toward its open pose.
    expect(group.rotation.x).toBeLessThan(-0.5);
    expect(group.position.y).toBeGreaterThan(lidPart.position![1] + 0.02);

    act(() => usePortfolioStore.getState().selectProject(null));
    await renderer.advanceFrames(30, 0.05);
    // Deselected: it settles back to the exact closed pose.
    expect(group.rotation.x).toBeCloseTo(0, 3);
    expect(group.position.y).toBeCloseTo(lidPart.position![1], 3);

    await renderer.unmount();
    disposeRoomMaterials(materials);
  });

  it('reuses the room-owned geometries/materials — allocates no GPU resources', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ProjectCases cases={cases} materials={materials} />,
      { frameloop: 'never' },
    );
    const meshes = renderer.scene.findAll((node) => node.type === 'Mesh');
    expect(meshes).toHaveLength(PROJECTS.length * 2); // body + lid per case

    const lidPart = cases.find((part) => part.id === `case-lid-0`)!;
    const lidMesh = meshes
      .map((node) => node.instance as THREE.Mesh)
      .find((mesh) => mesh.geometry === lidPart.geometry);
    expect(lidMesh).toBeDefined();
    expect(lidMesh!.material).toBe(materials[lidPart.material]);

    await renderer.unmount();
    disposeRoomMaterials(materials);
    // Geometries belong to Room's furniture and are freed by its teardown, not
    // by this zone. Never dispose them here: `cases` is module-level shared by
    // every test in this file and a disposed geometry breaks later/re-run tests.
    expect(lidPart.geometry).toBeInstanceOf(THREE.BufferGeometry);
  });
});

describe('shared project detail dialog', () => {
  it('renders the selected project with repo link and accessible tags', async () => {
    usePortfolioStore.setState({ selectedProjectId: postId(publicProject) });
    renderProjects();

    const dialog = screen.getByRole('dialog', {
      name: new RegExp(publicProject.title),
    });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Verbatim description + full tag list are ordinary DOM (never canvas).
    expect(dialog).toHaveTextContent('48% accuracy');
    const tags = within(dialog).getByRole('list', {
      name: `Tags for ${publicProject.title}`,
    });
    for (const tag of displayTags(publicProject)) {
      expect(tags).toHaveTextContent(tag);
    }

    const repo = within(dialog).getByRole('link', {
      name: /Open repository for .* \(opens in a new tab\)/,
    });
    expect(repo).toHaveAttribute('href', publicProject.repoUrl);
    expect(repo).toHaveAttribute('target', '_blank');
    expect(repo).toHaveAttribute('rel', 'noopener noreferrer');

    expect(
      screen.getByText(`Project case opened for ${publicProject.title}`),
    ).toBeInTheDocument();
  });

  it('only one modal dialog can own the screen', async () => {
    usePortfolioStore.setState({ selectedPostId: postId(PROJECTS[1]!) });
    act(() => usePortfolioStore.getState().selectProject(firstId));
    const state = usePortfolioStore.getState();
    expect(state.selectedProjectId).toBe(firstId);
    expect(state.selectedPostId).toBeNull();
  });

  it('traps focus, closes on Esc and restores focus to the opener', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    usePortfolioStore.setState({ selectedProjectId: firstId });
    renderProjects();

    const dialog = await screen.findByRole('dialog', {
      name: new RegExp(first.title),
    });
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement),
    );

    await userEvent.keyboard('{Escape}');
    expect(usePortfolioStore.getState().selectedProjectId).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });

  it('closes on the close button and on backdrop click', async () => {
    const user = userEvent.setup();
    usePortfolioStore.setState({ selectedProjectId: firstId });
    renderProjects();

    const dialog = screen.getByRole('dialog', {
      name: new RegExp(first.title),
    });
    await user.click(
      within(dialog).getByRole('button', {
        name: `Close details for ${first.title}`,
      }),
    );
    expect(usePortfolioStore.getState().selectedProjectId).toBeNull();

    // Reopen via the store, then dismiss through the backdrop.
    act(() => usePortfolioStore.getState().selectProject(firstId));
    const backdrop = document.querySelector(
      '.project-detail-overlay .post-detail-backdrop',
    ) as HTMLElement;
    await user.click(backdrop);
    expect(usePortfolioStore.getState().selectedProjectId).toBeNull();
  });

  it('clears the selection on a 3D → 2D switch and unmounts the dialog', async () => {
    // Mount in 2D first: App's one-shot capability effect would otherwise
    // clear a 3D selection set before the initial commit.
    renderProjects();
    act(() => {
      usePortfolioStore.setState({ mode: '3d', selectedProjectId: firstId });
    });
    expect(
      screen.getByRole('dialog', { name: new RegExp(first.title) }),
    ).toBeInTheDocument();

    act(() => usePortfolioStore.getState().setMode('2d'));
    expect(usePortfolioStore.getState().selectedProjectId).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('keyboard-operable DOM equivalent (unchanged)', () => {
  it('exposes a data-project-id for all five cases and keeps the open toggles', () => {
    const main = renderProjects();
    const cards = main.querySelectorAll('[data-project-id]');
    expect(cards).toHaveLength(PROJECTS.length);
    for (const project of PROJECTS) {
      expect(
        main.querySelector(`[data-project-id="${postId(project)}"]`),
      ).toBeInTheDocument();
    }
    expect(
      within(main).getAllByRole('button', { name: 'Open case' }),
    ).toHaveLength(PROJECTS.length);
  });

  it('highlights only the DOM twin of a hovered/selected case', () => {
    const main = renderProjects();
    act(() => usePortfolioStore.getState().setHoveredProject(firstId));
    expect(main.querySelector(`[data-project-id="${firstId}"]`)).toHaveClass(
      'p5-card--highlight',
    );
    const other = postId(PROJECTS[1]!);
    expect(main.querySelector(`[data-project-id="${other}"]`)).not.toHaveClass(
      'p5-card--highlight',
    );
  });

  it('a DOM case toggle still expands details without the 3D scene', async () => {
    const user = userEvent.setup();
    const main = renderProjects();
    const toggle = within(main).getAllByRole('button', {
      name: 'Open case',
    })[0]!;
    toggle.focus();
    expect(toggle).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByTestId('post-description')).toBeInTheDocument();
  });
});
