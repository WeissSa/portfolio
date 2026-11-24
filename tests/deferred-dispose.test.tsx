/**
 * StrictMode regression (owner bug 2026-11-24): in dev, effects mount →
 * cleanup → mount again while useMemo keeps the SAME GPU resources. Immediate
 * disposal in that first cleanup produced a blank purple field. These tests
 * pin the deferred-disposal contract at the hook and at the real Room tree.
 */
import { StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { useDeferredDispose } from '../src/lib/deferred-dispose';
import {
  bindPainterlyDiffuse,
  createPainterlyUniforms,
} from '../src/scene/effects/PainterlyPass';
import { RoomScene } from '../src/scene/Room';
import type { TextureFactory } from '../src/scene/art/textures';

async function flushTimers(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

function Harness({ resource }: { resource: { dispose: () => void } }) {
  useDeferredDispose(() => resource.dispose(), [resource]);
  return null;
}

describe('useDeferredDispose', () => {
  it('does NOT dispose across StrictMode simulated unmount', async () => {
    const resource = { dispose: vi.fn() };
    const view = render(
      <StrictMode>
        <Harness resource={resource} />
      </StrictMode>,
    );
    await flushTimers();
    expect(
      resource.dispose,
      'StrictMode remount reuses memoized resources',
    ).not.toHaveBeenCalled();
    view.unmount();
    await flushTimers();
    expect(
      resource.dispose,
      'real unmount still disposes once',
    ).toHaveBeenCalledTimes(1);
  });

  it('disposes the old generation on a genuine dependency change', async () => {
    const first = { dispose: vi.fn() };
    const second = { dispose: vi.fn() };
    const view = render(<Harness resource={first} />);
    view.rerender(<Harness resource={second} />);
    await flushTimers();
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(second.dispose).not.toHaveBeenCalled();
    view.unmount();
    await flushTimers();
    expect(second.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('PainterlyPass sampler rebinding (StrictMode dev blank-field bug)', () => {
  it('points tDiffuse at the CURRENT render target after a generation mismatch', () => {
    const uniforms = createPainterlyUniforms();
    const stale = new THREE.WebGLRenderTarget(2, 2);
    const current = new THREE.WebGLRenderTarget(4, 4);
    bindPainterlyDiffuse(uniforms, stale);
    expect(uniforms.tDiffuse.value).toBe(stale.texture);
    // A second memo generation supplies a different target; the blit must
    // sample the new one (the pre-fix code kept the stale texture forever).
    bindPainterlyDiffuse(uniforms, current);
    expect(uniforms.tDiffuse.value).toBe(current.texture);
    stale.dispose();
    current.dispose();
  });
});

const stubTextureFactory: TextureFactory = () => new THREE.Texture();

describe('RoomScene under StrictMode', () => {
  it('keeps its geometry and material resources alive after the dev double-invoke', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StrictMode>
        <RoomScene
          seed="strict-smoke"
          quality="desktop"
          textureFactory={stubTextureFactory}
        />
      </StrictMode>,
      { frameloop: 'never' },
    );
    const mesh = renderer.scene.findAll((node) => node.type === 'Mesh')[0];
    const geometry = (mesh?.instance as THREE.Mesh)
      .geometry as THREE.BufferGeometry;
    const material = (mesh?.instance as THREE.Mesh).material as THREE.Material;
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeMaterial = vi.spyOn(material, 'dispose');
    await flushTimers();
    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(disposeMaterial).not.toHaveBeenCalled();
    await renderer.unmount();
    await flushTimers();
    expect(
      disposeGeometry,
      'real unmount must still free GPU geometry',
    ).toHaveBeenCalledTimes(1);
    expect(disposeMaterial).toHaveBeenCalled();
  });
});
