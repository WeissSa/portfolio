/**
 * polish(e): a handful of dust motes drifting inside the projector's additive
 * light beam. All animation lives in the vertex shader and is driven by the
 * shared perf clock (`advancePainterlyTime`, the same step PainterlyPass uses),
 * so the CPU cost per rendered frame is ONE uniform write and ZERO allocations.
 *
 * Contract:
 *  - No new lights (the beam material already glows additively), no new light
 *    cap pressure, no full-size texture.
 *  - No new frame requests: useFrame only runs on frames another invalidation
 *    already scheduled. At idle R3F renders 0 frames, so the motes are frozen.
 *  - `freezeTime` (reduced motion) freezes the clock, matching PainterlyPass.
 *  - Geometry/material are created once per mount and disposed DEFERRED so a
 *    StrictMode simulated unmount cannot leave the remount drawing freed GPU
 *    resources (same rule as Room.tsx / PainterlyPass).
 */
import { useMemo, useRef, type JSX } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useDeferredDispose } from '../../lib/deferred-dispose';
import { advancePainterlyTime } from '../diegetic';
import { PALETTE } from '../art/palette';

const MOTE_COUNT = 22;
const BEAM_LENGTH = 2.4; // matches createLightCone(); cone opens toward -z.
const BEAM_RADIUS = 0.75;

const DUST_VERTEX_SHADER = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uLength;
uniform float uRadius;
varying float vFade;
void main() {
  float s = aSeed;
  // Slow travel down the beam, wrapped so motes recycle at the screen.
  float t = fract(s * 0.731 + uTime * 0.035);
  float z = -t * uLength;
  float spread = 1.0 - (z / uLength) * 0.75;
  float x = (fract(s * 91.7) - 0.5) * uRadius * spread;
  float y = (fract(s * 47.3) - 0.5) * uRadius * 0.55 * spread;
  x += 0.018 * sin(uTime * 0.7 + s * 30.0);
  y += 0.012 * cos(uTime * 0.55 + s * 17.0);
  vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(2.6 / max(0.2, -mv.z), 1.0, 3.2);
  // Fade in at the lens and out at the screen so motes never pop at the wrap.
  vFade = sin(t * 3.14159) * (0.28 + 0.22 * sin(uTime * 1.1 + s * 43.0));
}
`;

const DUST_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uColor;
varying float vFade;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.0, d) * vFade;
  gl_FragColor = vec4(uColor, alpha);
}
`;

export interface DustMotesProps {
  /** Freeze the mote clock (reduced-motion 3D opt-in). */
  freezeTime?: boolean;
}

export function DustMotes({ freezeTime = false }: DustMotesProps): JSX.Element {
  // Hold the time uniform object directly so useFrame never indexes an
  // optional `uniforms.uTime` (noUncheckedIndexedAccess) and never allocates.
  const uTime = useMemo(() => ({ value: 0 }), []);
  const resources = useMemo(() => {
    // `position` supplies the vertex count; all motion is computed in GLSL.
    const positions = new Float32Array(MOTE_COUNT * 3);
    const seeds = new Float32Array(MOTE_COUNT);
    for (let i = 0; i < MOTE_COUNT; i += 1) seeds[i] = (i + 0.5) / MOTE_COUNT;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime,
        uLength: { value: BEAM_LENGTH },
        uRadius: { value: BEAM_RADIUS },
        uColor: { value: new THREE.Color(PALETTE.lampWarm) },
      },
      vertexShader: DUST_VERTEX_SHADER,
      fragmentShader: DUST_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material };
  }, [uTime]);

  useDeferredDispose(() => {
    resources.geometry.dispose();
    resources.material.dispose();
  }, [resources]);

  const time = useRef(0);
  useFrame((_state, delta) => {
    time.current = advancePainterlyTime(
      time.current,
      Math.min(delta, 0.1),
      freezeTime,
    );
    uTime.value = time.current;
  });

  return (
    <points
      // Shader moves vertices outside the (all-zero) bounding sphere, so the
      // default frustum cull would drop the whole cloud at some camera angles.
      frustumCulled={false}
      geometry={resources.geometry}
      material={resources.material}
      // Keep the room's frozen-matrix contract: bake once on mount/props.
      onUpdate={(object: THREE.Object3D) => object.updateMatrix()}
      matrixAutoUpdate={false}
    />
  );
}

/** Exported for the headless "resources disposed once" smoke assertions. */
export const DUST_MOTE_COUNT = MOTE_COUNT;
