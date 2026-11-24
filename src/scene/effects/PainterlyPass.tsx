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
 * (NoColorSpace) because three renders the scene in the working linear space
 * when drawing to a target. The final ShaderMaterial therefore ends with
 * `#include <colorspace_fragment>` — three injects `linearToOutputTexel()`
 * into every non-raw ShaderMaterial — so the graded linear color is encoded to
 * the renderer's output color space (sRGB) exactly once.
 *
 * Commit 3c perf audit (P3/P4): MSAA is 4→2 (the painted grain/stroke dithers
 * edges) and the target is 8-bit UNSIGNED_BYTE by default — the grade shader
 * clamps to [0,1] so no HDR range is needed, and the softened grain + 1/16
 * posterization dither any 8-bit shadow banding. HalfFloat remains available
 * ONLY behind EXT_color_buffer_float support via the pure chooser below; the
 * default path allocates half the bandwidth. Grain uTime only advances on
 * rendered frames: the demand frameloop emits no frames (and no grain churn)
 * while idle, so no extra timer work is needed.
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
uniform float uEdge;
uniform float uStroke;
varying vec2 vUv;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Shader-grade luma (Rec.601 — an artistic choice; WCAG math lives in
// grade-math.ts with Rec.709 and is kept strictly separate).
float luma601(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec3 color = texture2D(tDiffuse, vUv).rgb;
  float luma = luma601(color);

  // Oil-painting grade (commit 3b): PURPLE-tinted shadows + warmer sepia
  // highlights — the owner's unified Dishonored+purple palette carried into
  // the grade itself. Shadow tint loses the old teal lean (b: 0.10 -> 0.11,
  // g: 0.09 -> 0.05, r: 0.04 -> 0.065).
  vec3 shadowTint = vec3(0.065, 0.05, 0.11);
  vec3 highlightTint = vec3(0.12, 0.075, 0.025);
  vec3 graded = color + uGrade * (shadowTint * (1.0 - luma) + highlightTint * luma - 0.04 * color);

  // Gentle desaturation + S-curve contrast, like aged varnish.
  float gradedLuma = luma601(graded);
  graded = mix(vec3(gradedLuma), graded, 0.92);
  graded = (graded - 0.5) * 1.06 + 0.5;

  // Paint-stroke feel (commit 3b): subtle tonal posterization toward banded
  // oil paint. Amplitude is bounded (step 1/16, mixed at uStroke) so text
  // contrast stays inside the graded-contrast contract's noise floor.
  graded = mix(graded, (floor(graded * 16.0) + 0.5) / 16.0, uStroke);

  // Edge darkening (commit 3b): a 4-tap luma gradient darkens drawn edges,
  // like ink rubbed into the contours of a painting. Interior flat fields
  // (gradient ~ 0) are untouched, so large-area contrast is preserved.
  vec2 texel = 1.0 / uResolution;
  float lumaN = luma601(texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb);
  float lumaS = luma601(texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).rgb);
  float lumaE = luma601(texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb);
  float lumaW = luma601(texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).rgb);
  float edge = abs(lumaN - luma) + abs(lumaS - luma) + abs(lumaE - luma) + abs(lumaW - luma);
  graded *= 1.0 - uEdge * clamp(edge * 1.6, 0.0, 1.0);

  // Vignette.
  vec2 q = vUv - 0.5;
  graded *= clamp(1.0 - uVignette * dot(q, q) * 1.9, 0.0, 1.0);

  // Animated film grain (slow shimmer). SOFTENED per owner feedback
  // 2026-11-23 ("kinda grainy"): default amplitude 0.05 -> 0.02, and the
  // grade-contrast test asserts the numeric ceiling so it cannot re-harden.
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
  uEdge: { value: number };
  uStroke: { value: number };
}

export const PAINTERLY_DEFAULTS = {
  /** Owner feedback 2026-11-23: softened from 0.05 — do NOT re-harden
   *  without a new decision (grade-contrast.test.ts pins this ceiling). */
  grain: 0.02,
  vignette: 0.55,
  grade: 0.55,
  /** Edge-darkening amplitude (commit 3b). */
  edge: 0.16,
  /** Posterization/"brush stroke" mix (commit 3b). */
  stroke: 0.12,
} as const;

/** Plain-data uniform factory (unit-testable without a GL context). */
export function createPainterlyUniforms(
  overrides: Partial<{
    grain: number;
    vignette: number;
    grade: number;
    edge: number;
    stroke: number;
  }> = {},
): PainterlyUniforms {
  return {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uGrain: { value: overrides.grain ?? PAINTERLY_DEFAULTS.grain },
    uVignette: { value: overrides.vignette ?? PAINTERLY_DEFAULTS.vignette },
    uGrade: { value: overrides.grade ?? PAINTERLY_DEFAULTS.grade },
    uEdge: { value: overrides.edge ?? PAINTERLY_DEFAULTS.edge },
    uStroke: { value: overrides.stroke ?? PAINTERLY_DEFAULTS.stroke },
  };
}

/**
 * Pick the render-target type. 3c P4: UNSIGNED_BYTE is the DEFAULT (half the
 * bandwidth; the grain + stroke dither away 8-bit banding). HalfFloat is opt-in
 * AND gated on EXT_color_buffer_float — it is never selected on an unsupported
 * context, so the flag remains the hard fallback guard. Pure + exported so the
 * decision is testable without a GL context.
 */
export function choosePainterlyTargetType(
  hasFloatColorBuffer: boolean,
  preferHalfFloat = false,
): THREE.TextureDataType {
  return hasFloatColorBuffer && preferHalfFloat
    ? THREE.HalfFloatType
    : THREE.UnsignedByteType;
}

/** Pure grain-clock step: reduced-motion 3D holds uTime at a fixed value. */
export function advancePainterlyTime(
  current: number,
  delta: number,
  frozen = false,
): number {
  return frozen ? current : current + delta;
}

export interface PainterlyPassProps {
  enabled: boolean;
  /** Freeze film-grain shimmer (reduced-motion 3D opt-in, commit 4). */
  freezeTime?: boolean;
  grain?: number;
  vignette?: number;
  grade?: number;
  edge?: number;
  stroke?: number;
  children?: ReactNode;
}

export function PainterlyPass({
  enabled,
  freezeTime = false,
  grain = PAINTERLY_DEFAULTS.grain,
  vignette = PAINTERLY_DEFAULTS.vignette,
  grade = PAINTERLY_DEFAULTS.grade,
  edge = PAINTERLY_DEFAULTS.edge,
  stroke = PAINTERLY_DEFAULTS.stroke,
  children,
}: PainterlyPassProps): ReactNode {
  if (!enabled) return children ?? null;
  return (
    <PainterlyPassInner
      freezeTime={freezeTime}
      grain={grain}
      vignette={vignette}
      grade={grade}
      edge={edge}
      stroke={stroke}
    >
      {children}
    </PainterlyPassInner>
  );
}

function PainterlyPassInner({
  freezeTime = false,
  grain = PAINTERLY_DEFAULTS.grain,
  vignette = PAINTERLY_DEFAULTS.vignette,
  grade = PAINTERLY_DEFAULTS.grade,
  edge = PAINTERLY_DEFAULTS.edge,
  stroke = PAINTERLY_DEFAULTS.stroke,
  children,
}: Omit<PainterlyPassProps, 'enabled'>): ReactNode {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  const uniforms = useMemo(
    () => createPainterlyUniforms({ grain, vignette, grade, edge, stroke }),
    // Strength changes are rare (tier switches); rebuilding the material is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    uniforms.uGrain.value = grain;
    uniforms.uVignette.value = vignette;
    uniforms.uGrade.value = grade;
    uniforms.uEdge.value = edge;
    uniforms.uStroke.value = stroke;
  }, [grain, vignette, grade, edge, stroke, uniforms]);

  // Float attachments are queried as a SAFETY GATE: the shipped path is 8-bit,
  // but any future half-float opt-in must still be gated on this extension.
  // A missing/failed query (mock or restricted context) never throws.
  const supportsFloatTargets = useMemo(() => {
    try {
      return Boolean(gl.getContext().getExtension('EXT_color_buffer_float'));
    } catch {
      return false;
    }
  }, [gl]);

  const rig = useMemo(() => {
    // Linear 8-bit target; grain/stroke dither the banding, MSAA 4→2 because
    // the painted grain already softens edges (commit 3c P3/P4).
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: choosePainterlyTargetType(supportsFloatTargets),
      samples: 2, // WebGL2 MSAA; ignored where unavailable.
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
  }, [uniforms, supportsFloatTargets]);

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
    time.current = advancePainterlyTime(time.current, delta, freezeTime);
    uniforms.uTime.value = time.current;
    // QA hook (commit 4): expose the ACTUAL shader clock so the Playwright
    // harness can assert it is frozen in the reduced-motion 3D opt-in.
    if (freezeTime && typeof document !== 'undefined') {
      document.documentElement.dataset.grainTime = String(time.current);
    }
    gl.setRenderTarget(rig.target);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.render(rig.quadScene, rig.quadCamera);
  }, 1); // priority ≥ 1 → R3F skips its automatic render.

  return children ?? null;
}
