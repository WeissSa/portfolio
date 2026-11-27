/**
 * Library experience (REWORK_PLAN §3.2.1 / §4.8, commit 6): book selection →
 * the SAME DOM detail panel, ★ featured styling, keyboard-reachable DOM
 * equivalent, hover parity and resource disposal. R3F tests are structural
 * (no pixel verification — appearance needs a real browser screenshot review).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as THREE from 'three';
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import App from '../src/App';
import { POSTS, postId } from '../src/content/posts';
import { usePortfolioStore, detailPostId } from '../src/state/store';
import {
  createRoomMaterials,
  disposeRoomMaterials,
  type RoomMaterials,
} from '../src/scene/art/materials';
import { createBookshelf } from '../src/scene/art/geometry';
import { LibraryZone } from '../src/scene/zones/Library';

beforeEach(() => {
  usePortfolioStore.setState({
    activeDetail: null,
    hoveredPostId: null,
    pointerFine: false,
  });
  document.body.style.cursor = '';
});

const first = POSTS[0]!;
const second = POSTS[1]!;

function renderExperience() {
  window.location.hash = '#/experience';
  render(<App />);
}

describe('book selection → shared DOM detail panel', () => {
  it('post ids are unique so DOM/store lookups are unambiguous', () => {
    const ids = POSTS.map(postId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('opens the PostCard detail for the selected post with an aria-live notice', async () => {
    usePortfolioStore.setState({
      activeDetail: { kind: 'post', id: postId(first) },
    });
    renderExperience();

    const dialog = screen.getByRole('dialog', {
      name: new RegExp(first.title),
    });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // The SAME PostCard markup as 2D: description + NDA note are real DOM.
    expect(dialog).toHaveTextContent(
      /After graduating I happily took a return offer to Gusto/,
    );
    expect(dialog).toHaveTextContent(
      'Source code is private — details under NDA.',
    );
    expect(
      screen.getByText(`Details opened for ${first.title}`),
    ).toBeInTheDocument();
  });

  it('renders the ★ featured marker inside the detail for a featured post', () => {
    const featured = POSTS.find((post) => post.featured)!;
    usePortfolioStore.setState({
      activeDetail: { kind: 'post', id: postId(featured) },
    });
    renderExperience();
    const dialog = screen.getByRole('dialog', {
      name: new RegExp(featured.title),
    });
    // PostCard's StarMark exposes "Featured" to screen readers.
    expect(dialog).toHaveTextContent('Featured');
    expect(dialog).toHaveTextContent('★');
  });

  it('Esc closes the panel and restores focus to the opener', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    usePortfolioStore.setState({
      activeDetail: { kind: 'post', id: postId(first) },
    });
    render(<App />);

    const dialog = await screen.findByRole('dialog', {
      name: new RegExp(first.title),
    });
    await waitFor(() =>
      expect(dialog).toContainElement(
        document.activeElement as HTMLElement | null,
      ),
    );

    await userEvent.keyboard('{Escape}');
    expect(detailPostId(usePortfolioStore.getState().activeDetail)).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });
});

describe('accessible DOM equivalent (never canvas-gated)', () => {
  it('every post card is keyboard-operable: Enter expands its details', async () => {
    const user = userEvent.setup();
    renderExperience();

    const toggles = screen.getAllByRole('button', { name: 'Details' });
    expect(toggles).toHaveLength(POSTS.length); // 13 real buttons
    const toggle = toggles[0]!;
    toggle.focus();
    expect(toggle).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByTestId('post-description')).toBeInTheDocument();
  });

  it('highlights one DOM card on hover and replaces the zone behind an open detail', () => {
    usePortfolioStore.setState({ hoveredPostId: postId(first) });
    renderExperience();
    const main = document.getElementById('main') as HTMLElement;
    expect(main.querySelector(`[data-post-id="${postId(first)}"]`)).toHaveClass(
      'p5-card--highlight',
    );
    expect(
      main.querySelector(`[data-post-id="${postId(second)}"]`),
    ).not.toHaveClass('p5-card--highlight');

    // ONE surface per content: selecting a book unmounts the zone list behind
    // the detail instead of showing the same post twice.
    act(() =>
      usePortfolioStore.setState({
        activeDetail: { kind: 'post', id: postId(first) },
        hoveredPostId: null,
      }),
    );
    expect(main.querySelector(`[data-post-id="${postId(first)}"]`)).toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    act(() => usePortfolioStore.setState({ activeDetail: null }));
  });
});

describe('R3F book zone (headless, structural only)', () => {
  const cells = createBookshelf('library-test').cells;
  let materials: RoomMaterials;

  beforeEach(() => {
    materials = createRoomMaterials({ bookAtlas: new THREE.Texture() });
  });

  it('picking a book instance writes its post id to the store', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LibraryZone cells={cells} materials={materials} />,
      { frameloop: 'never' },
    );
    const instanced = renderer.scene
      .findAll((node) =>
        Boolean(
          (node.instance as THREE.InstancedMesh | undefined)?.isInstancedMesh,
        ),
      )
      .find(
        (node) =>
          (node.instance as THREE.InstancedMesh | undefined)?.count ===
          POSTS.length,
      );
    expect(instanced).toBeDefined();

    const stopPropagation = vi.fn();
    act(() => {
      instanced!.props.onClick({ instanceId: 2, stopPropagation });
    });
    expect(detailPostId(usePortfolioStore.getState().activeDetail)).toBe(
      postId(POSTS[2]!),
    );
    expect(stopPropagation).toHaveBeenCalledTimes(1);

    act(() => {
      instanced!.props.onPointerOver({ instanceId: 2, stopPropagation });
    });
    expect(usePortfolioStore.getState().hoveredPostId).toBe(postId(POSTS[2]!));
    expect(document.body.style.cursor).toBe('pointer');

    act(() => {
      instanced!.props.onPointerOut({ stopPropagation });
    });
    expect(usePortfolioStore.getState().hoveredPostId).toBeNull();
    expect(document.body.style.cursor).toBe('');

    await renderer.unmount();
    disposeRoomMaterials(materials);
  });

  it("the selected book's label geometry rides out with its body (A1)", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LibraryZone cells={cells} materials={materials} />,
      { frameloop: 'never' },
    );
    const labelZ = (index: number): number => {
      const node = renderer.scene.find(
        (candidate) =>
          candidate.type === 'Mesh' &&
          !(candidate.instance as THREE.InstancedMesh | undefined)
            ?.isInstancedMesh,
      );
      const geometry = (node!.instance as THREE.Mesh)
        .geometry as THREE.BufferGeometry;
      return geometry.getAttribute('position').getZ(index * 4);
    };

    const selected = 2;
    const beforeSelected = labelZ(selected);
    const beforeOther = labelZ(0);
    act(() => {
      usePortfolioStore.setState({
        activeDetail: { kind: 'post', id: postId(POSTS[selected]!) },
      });
    });
    expect(labelZ(selected) - beforeSelected).toBeCloseTo(0.13, 6);
    // Neighbouring spines stay put — only the selected quad translates.
    expect(labelZ(0)).toBeCloseTo(beforeOther, 6);

    act(() => {
      usePortfolioStore.setState({ activeDetail: null });
    });
    expect(labelZ(selected)).toBeCloseTo(beforeSelected, 6);
    await renderer.unmount();
  });

  it('disposes its body + spine-label geometries on unmount', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LibraryZone cells={cells} materials={materials} />,
      { frameloop: 'never' },
    );
    const body = renderer.scene.find((node) =>
      Boolean(
        (node.instance as THREE.InstancedMesh | undefined)?.isInstancedMesh,
      ),
    );
    const labels = renderer.scene.find(
      (node) =>
        node.type === 'Mesh' &&
        !(node.instance as THREE.InstancedMesh | undefined)?.isInstancedMesh,
    );
    expect(body).toBeDefined();
    expect(labels).toBeDefined();

    const bodyGeometry = (body!.instance as THREE.InstancedMesh).geometry;
    const labelGeometry = (labels!.instance as THREE.Mesh).geometry;
    const bodyDispose = vi.spyOn(bodyGeometry, 'dispose');
    const labelDispose = vi.spyOn(labelGeometry, 'dispose');

    await renderer.unmount();
    // Deferred disposal (StrictMode-safe) runs one macrotask after unmount.
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 10));
    expect(bodyDispose).toHaveBeenCalled();
    expect(labelDispose).toHaveBeenCalled();
    disposeRoomMaterials(materials);
  });
});

describe('UX fix: no painted book page in the room', () => {
  const cells = createBookshelf('detail-gate-test').cells;
  let materials: RoomMaterials;

  beforeEach(() => {
    materials = createRoomMaterials({ bookAtlas: new THREE.Texture() });
    usePortfolioStore.setState({
      activeDetail: { kind: 'post', id: postId(first) },
      mode: '3d',
      sceneReady: true,
      pointerFine: true,
    });
  });

  it('never paints truncated pages — the pulled-out book is the gesture, the DOM panel is the reading', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LibraryZone cells={cells} materials={materials} />,
      { frameloop: 'never' },
    );
    const painted = () =>
      renderer.scene.findAll((node) => node.props.name === 'open-book-detail');
    expect(painted()).toHaveLength(0);
    await renderer.unmount();
    disposeRoomMaterials(materials);
  });
});
