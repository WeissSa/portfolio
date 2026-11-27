/**
 * polish(e): ambient dust-mote contracts — the shader cloud owns its GPU
 * resources (deferred, StrictMode-safe), threads the freeze flag into the
 * SAME perf-clock step PainterlyPass uses, and derives its envelope from the
 * REAL beam geometry so the cloud can neither leak outside the cone nor stop
 * short of the screen.
 */
import { StrictMode } from 'react';
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  DustMotes,
  DUST_MOTE_COUNT,
  moteRadialEnvelope,
} from '../src/scene/ambient/DustMotes';
import { beamEnvelope, createLightCone } from '../src/scene/art/geometry';
import { RoomScene } from '../src/scene/Room';
import type { TextureFactory } from '../src/scene/art/textures';

const { advanceSpy } = vi.hoisted(() => ({
  advanceSpy: vi.fn((current: number, delta: number, frozen = false) =>
    frozen ? current : current + delta,
  ),
}));

vi.mock('../src/scene/diegetic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/scene/diegetic')>();
  return { ...actual, advancePainterlyTime: advanceSpy };
});

/** The production beam (static-cache.ts) is the single envelope authority. */
const BEAM = beamEnvelope(createLightCone(3.85, 0.62).geometry);
const MOTES = { beamLength: BEAM.length, beamRadius: BEAM.radius };

async function flushTimers(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

describe('projector dust motes', () => {
  it('owns one tiny point cloud (no new light or full-size texture)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <DustMotes {...MOTES} />,
      { frameloop: 'never' },
    );
    const points = renderer.scene.findAll((node) => node.type === 'Points');
    expect(points).toHaveLength(1);
    const cloud = points[0]!.instance as THREE.Points;
    const geometry = cloud.geometry as THREE.BufferGeometry;
    expect(geometry.getAttribute('position').count).toBe(DUST_MOTE_COUNT);
    expect(geometry.getAttribute('aSeed').count).toBe(DUST_MOTE_COUNT);
    expect(DUST_MOTE_COUNT).toBeLessThanOrEqual(32);
    const material = cloud.material as THREE.ShaderMaterial;
    expect(material.blending).toBe(THREE.AdditiveBlending);
    expect(material.depthWrite).toBe(false);
    expect(cloud.frustumCulled).toBe(false);
    await renderer.unmount();
    await flushTimers();
  });

  it('does not dispose across StrictMode remount, then disposes once', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StrictMode>
        <DustMotes {...MOTES} />
      </StrictMode>,
      { frameloop: 'never' },
    );
    const cloud = renderer.scene.find((node) => node.type === 'Points')!
      .instance as THREE.Points;
    const geometry = cloud.geometry as THREE.BufferGeometry;
    const material = cloud.material as THREE.ShaderMaterial;
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeMaterial = vi.spyOn(material, 'dispose');

    await flushTimers();
    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(disposeMaterial).not.toHaveBeenCalled();

    await renderer.unmount();
    await flushTimers();
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(disposeMaterial).toHaveBeenCalledTimes(1);
  });

  it('threads freezeTime into the per-frame clock step and freezes uTime', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <DustMotes {...MOTES} freezeTime />,
      { frameloop: 'never' },
    );
    const cloud = renderer.scene.find((node) => node.type === 'Points')!
      .instance as THREE.Points;
    const material = cloud.material as THREE.ShaderMaterial;
    advanceSpy.mockClear();
    await act(async () => {
      await renderer.advanceFrames(2, 0.016);
    });
    expect(advanceSpy).toHaveBeenCalledTimes(2);
    expect(advanceSpy).toHaveBeenNthCalledWith(1, 0, 0.016, true);
    expect(advanceSpy).toHaveBeenNthCalledWith(2, 0, 0.016, true);
    expect(material.uniforms.uTime!.value).toBe(0);
    await renderer.unmount();
    await flushTimers();
  });

  it('advances uTime on the shared clock when motion is allowed', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <DustMotes {...MOTES} />,
      { frameloop: 'never' },
    );
    const cloud = renderer.scene.find((node) => node.type === 'Points')!
      .instance as THREE.Points;
    const material = cloud.material as THREE.ShaderMaterial;
    advanceSpy.mockClear();
    await act(async () => {
      await renderer.advanceFrames(3, 0.016);
    });
    expect(advanceSpy).toHaveBeenCalledTimes(3);
    expect(advanceSpy).toHaveBeenNthCalledWith(1, 0, 0.016, false);
    expect(material.uniforms.uTime!.value).toBeCloseTo(0.048, 6);
    await renderer.unmount();
    await flushTimers();
  });

  it('derives its envelope from the real beam geometry (no hardcoded mismatch)', async () => {
    const stubTextureFactory: TextureFactory = () => new THREE.Texture();
    const renderer = await ReactThreeTestRenderer.create(
      <RoomScene textureFactory={stubTextureFactory} />,
      { frameloop: 'never' },
    );
    // The projector beam is the ONLY ConeGeometry in the room.
    const beamMesh = renderer.scene
      .findAll((node) => node.type === 'Mesh')
      .find(
        (node) =>
          (node.instance as THREE.Mesh).geometry instanceof THREE.ConeGeometry,
      )!.instance as THREE.Mesh;
    const fromScene = beamEnvelope(beamMesh.geometry);
    expect(fromScene.length).toBeCloseTo(3.85, 6);
    expect(fromScene.radius).toBeCloseTo(0.62, 6);

    const cloud = renderer.scene.find((node) => node.type === 'Points')!
      .instance as THREE.Points;
    const material = cloud.material as THREE.ShaderMaterial;
    // The mote uniforms MUST come from the beam mesh above — never a
    // duplicated 2.4/0.75 constant that silently drifts from production.
    expect(material.uniforms.uLength!.value).toBeCloseTo(fromScene.length, 6);
    expect(material.uniforms.uRadius!.value).toBeCloseTo(fromScene.radius, 6);

    // Spread grows with depth (cone radius ∝ t): motes stay inside the cone
    // and reach the screen instead of stopping ~1.45 m short.
    const vertexShader = material.vertexShader;
    expect(vertexShader).toContain('float spread = t;');
    expect(vertexShader).toContain('float z = -t * uLength;');
    expect(vertexShader).not.toContain('0.75');
    for (let t = 0; t <= 1; t += 0.02) {
      const coneRadiusAtDepth = fromScene.radius * t;
      // radial envelope is centred, so compare against the full cone radius.
      expect(moteRadialEnvelope(t, fromScene.radius)).toBeLessThanOrEqual(
        coneRadiusAtDepth + 1e-9,
      );
    }
    expect(moteRadialEnvelope(1, fromScene.radius)).toBeGreaterThan(0);

    await renderer.unmount();
    await flushTimers();
  });
});
