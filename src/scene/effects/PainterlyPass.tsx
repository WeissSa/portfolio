/**
 * Cheap single-pass painterly post effect (REWORK_PLAN §3.5/§4.3):
 * grain + vignette + warm-highlight/teal-shadow color grade, rendered as one
 * fullscreen quad from a WebGLRenderTarget — DESKTOP tier only. Mobile/low
 * tiers pass enabled=false and render the scene directly (no extra pass, no
 * render target).
 *
 * Implementation note: instead of pulling in the `postprocessing` package we
 * own the two-pass loop ourselves (useFrame with priority 1): render the main
 * scene into the target, then blit through the grade shader. ~40 lines, zero
 * extra dependencies in the 260 KB lazy-chunk budget.
 *
 * Color space (commit 5 review fix A): the render target stays LINEAR
 * (NoColorSpace, half-float) because three renders the scene in the working
 * linear space when drawing to a target. The final ShaderMaterial therefore
 * ends with `#include <colorspace_fragment>` — three injects
 * `linearToOutputTexel()` into every non-raw ShaderMaterial — so the graded
 * linear color is encoded to the renderer's output color space (sRGB) exactly
 * once. Without it the pass wrote linear values into an sRGB canvas (too dark,
 * wrong grade) and 8-bit linear storage banded badly in the shadows; the
 * half-float target removes that banding at negligible desktop cost.
 */
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

export const PAINTERLY_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  // Clip-space fullscreen quad: position.xy already spans [-1, 1].
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const PAINTERLY_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uTime;
uniform float uGrain;
uniform float uVignette;
uniform float uGrade;
varying vec2 vUv;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec3 color = texture2D(tDiffuse, vUv).rgb;
  float luma = dot(color, vec3(0.299, 0.587, 0.114));

  // Oil-painting grade: teal-ish shadows, warm sepia highlights (Dishonored).
  vec3 shadowTint = vec3(0.04, 0.09, 0.10);
  vec3 highlightTint = vec3(0.11, 0.07, 0.02);
  vec3 graded = color + uGrade * (shadowTint * (1.0 - luma) + highlightTint * luma - 0.04 * color);

  // Gentle desaturation + S-curve contrast, like aged varnish.
  float gradedLuma = dot(graded, vec3(0.299, 0.587, 0.114));
  graded = mix(vec3(gradedLuma), graded, 0.92);
  graded = (graded - 0.5) * 1.06 + 0.5;

  // Vignette.
  vec2 q = vUv - 0.5;
  graded *= clamp(1.0 - uVignette * dot(q, q) * 1.9, 0.0, 1.0);

  // Animated film grain (slow shimmer, photosensitivity-safe amplitude).
  float grain = hash21(vUv * uResolution + fract(uTime * 0.7) * 191.0);
  graded += (grain - 0.5) * uGrain;

  // The graded value is linear (the render target is linear). Convert once to
  // the renderer output color space — three defines linearToOutputTexel() for
  // ShaderMaterial via colorspace_pars_fragment in the program prefix.
  gl_FragColor = vec4(clamp(graded, 0.0, 1.0), 1.0);
  #include <colorspace_fragment>
}
`;

export interface PainterlyUniforms {
  tDiffuse: { value: THREE.Texture | null };
  uResolution: { value: THREE.Vector2 };
  uTime: { value: number };
  uGrain: { value: number };
  uVignette: { value: number };
  uGrade: { value: number };
}

export const PAINTERLY_DEFAULTS = {
  grain: 0.05,
  vignette: 0.55,
  grade: 0.55,
} as const;

/** Plain-data uniform factory (unit-testable without a GL context). */
export function createPainterlyUniforms(
  overrides: Partial<{ grain: number; vignette: number; grade: number }> = {},
): PainterlyUniforms {
  return {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uGrain: { value: overrides.grain ?? PAINTERLY_DEFAULTS.grain },
    uVignette: { value: overrides.vignette ?? PAINTERLY_DEFAULTS.vignette },
    uGrade: { value: overrides.grade ?? PAINTERLY_DEFAULTS.grade },
  };
}

export interface PainterlyPassProps {
  enabled: boolean;
  grain?: number;
  vignette?: number;
  grade?: number;
  children?: ReactNode;
}

export function PainterlyPass({
  enabled,
  grain = PAINTERLY_DEFAULTS.grain,
  vignette = PAINTERLY_DEFAULTS.vignette,
  grade = PAINTERLY_DEFAULTS.grade,
  children,
}: PainterlyPassProps): ReactNode {
  if (!enabled) return children ?? null;
  return (
    <PainterlyPassInner grain={grain} vignette={vignette} grade={grade}>
      {children}
    </PainterlyPassInner>
  );
}

function PainterlyPassInner({
  grain = PAINTERLY_DEFAULTS.grain,
  vignette = PAINTERLY_DEFAULTS.vignette,
  grade = PAINTERLY_DEFAULTS.grade,
  children,
}: Omit<PainterlyPassProps, 'enabled'>): ReactNode {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  const uniforms = useMemo(
    () => createPainterlyUniforms({ grain, vignette, grade }),
    // Strength changes are rare (tier switches); rebuilding the material is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    uniforms.uGrain.value = grain;
    uniforms.uVignette.value = vignette;
    uniforms.uGrade.value = grade;
  }, [grain, vignette, grade, uniforms]);

  const rig = useMemo(() => {
    // Keep the target linear (Texture.colorSpace defaults to NoColorSpace),
    // half-float to avoid 8-bit linear banding. Desktop tier only.
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: 4, // WebGL2 MSAA; ignored where unavailable.
    });
    const quadScene = new THREE.Scene();
    const quadCamera = new THREE.Camera(); // Identity matrices + clip-space quad.
    const material = new THREE.ShaderMaterial({
      uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
      vertexShader: PAINTERLY_VERTEX_SHADER,
      fragmentShader: PAINTERLY_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    quadScene.add(quad);
    uniforms.tDiffuse.value = target.texture;
    return { target, quadScene, quadCamera, material, quad };
  }, [uniforms]);

  // Keep the target in sync with the drawing-buffer size.
  useEffect(() => {
    const dpr = gl.getPixelRatio();
    const width = Math.max(1, Math.floor(size.width * dpr));
    const height = Math.max(1, Math.floor(size.height * dpr));
    rig.target.setSize(width, height);
    uniforms.uResolution.value.set(width, height);
  }, [gl, size, rig, uniforms]);

  // Dispose GPU resources on unmount.
  useEffect(() => {
    return () => {
      rig.target.dispose();
      rig.material.dispose();
      rig.quad.geometry.dispose();
    };
  }, [rig]);

  const time = useRef(0);
  useFrame((_state, delta) => {
    time.current += delta;
    uniforms.uTime.value = time.current;
    gl.setRenderTarget(rig.target);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.render(rig.quadScene, rig.quadCamera);
  }, 1); // priority ≥ 1 → R3F skips its automatic render.

  return children ?? null;
}
