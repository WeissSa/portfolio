/**
 * Pure, deterministic port of the PainterlyPass GLSL grade (commit 1b).
 *
 * The shader in PainterlyPass.tsx is the runtime implementation; this module
 * mirrors its constants and arithmetic in plain TS so the palette's contrast
 * can be computed headlessly (no GL context) across the full range of lamp
 * brightness, vignette position and film grain. A parity test pins the shared
 * numeric constants so the two copies cannot drift silently.
 *
 * Color spaces: the render target is LINEAR, so inputs here are linear RGB
 * (sRGB hex decoded first) and the result is linear too. WCAG relative
 * luminance is defined as the linearized value of the *displayed* sRGB color —
 * which is exactly this linear grade output (the shader encodes to sRGB once
 * at the end). Comparing ratios on these values is therefore the correct
 * post-grade contrast, not an approximation.
 */

export type Rgb = readonly [number, number, number];

/**
 * Mirror of the GLSL numeric literals in PAINTERLY_FRAGMENT_SHADER. The
 * shader's `luma` weights are Rec.601 — an artistic choice mirrored exactly
 * here for gradeLinear(). They are NOT the WCAG luminance coefficients; see
 * WCAG_LUMA below for contrast math.
 */
export const GRADE_CONSTANTS = {
  luma: [0.299, 0.587, 0.114] as const,
  shadowTint: [0.04, 0.09, 0.1] as const,
  highlightTint: [0.11, 0.07, 0.02] as const,
  baseSubtract: 0.04,
  desaturation: 0.92,
  contrast: 1.06,
  vignetteScale: 1.9,
} as const;

/**
 * WCAG 2.1 relative-luminance coefficients (Rec.709 / sRGB primaries). Kept
 * separate from GRADE_CONSTANTS.luma on purpose: the grade mirrors the
 * shader's Rec.601 luma, while every WCAG contrast computation below
 * (relativeLuminance / contrastRatio / hexContrast / gradedHexContrast) MUST
 * use Rec.709 weights per the WCAG 2.1 relative-luminance definition.
 */
export const WCAG_LUMA = [0.2126, 0.7152, 0.0722] as const;

/**
 * Relative lamp illumination sampled by the contrast test (dim → bright).
 * The grade itself is fixed at the shipped defaults; only illumination and
 * screen position vary, so the test covers the real worst cases.
 */
export const LAMP_K = { dim: 0.7, bright: 1.3 } as const;

export interface GradeParams {
  /** uGrade (0.55 default). */
  grade: number;
  /** uVignette (0.55 default). */
  vignette: number;
  /** uGrain amplitude (0.05 default). */
  grain: number;
  /** vUv of the sampled pixel; [0.5, 0.5] is the vignette center. */
  uv: readonly [number, number];
  /** One hash21() sample, shifted to [-0.5, 0.5] as in the shader. */
  grainSample?: number;
  /** Relative lamp illumination (1 = shipped nominal). */
  lampK?: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const dot = (a: Rgb, b: Rgb): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** IEC 61966-2-1 sRGB transfer function (the inverse of linearToSrgb). */
export function srgbToLinear(channel: number): number {
  const c = clamp01(channel);
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb(channel: number): number {
  const c = clamp01(channel);
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** Decode a #rgb / #rrggbb / #rrggbbaa hex string to LINEAR RGB. */
export function hexToLinearRgb(hex: string): Rgb {
  let value = hex.trim().replace(/^#/, '');
  if (value.length === 3 || value.length === 4) {
    value = value
      .slice(0, 3)
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (value.length !== 6 && value.length !== 8) return [0, 0, 0];
  const int = Number.parseInt(value.slice(0, 6), 16);
  if (!Number.isFinite(int)) return [0, 0, 0];
  return [
    srgbToLinear(((int >> 16) & 255) / 255),
    srgbToLinear(((int >> 8) & 255) / 255),
    srgbToLinear((int & 255) / 255),
  ];
}

/**
 * Apply the exact shader operation order to a linear color: grade → desaturate
 * → S-curve → vignette → grain → clamp. Returns LINEAR RGB in [0, 1].
 */
export function gradeLinear(input: Rgb, params: GradeParams): Rgb {
  const k = params.lampK ?? 1;
  const base: Rgb = [input[0] * k, input[1] * k, input[2] * k];
  const luma = dot(base, GRADE_CONSTANTS.luma);

  const graded: Rgb = [
    base[0] +
      params.grade *
        (GRADE_CONSTANTS.shadowTint[0] * (1 - luma) +
          GRADE_CONSTANTS.highlightTint[0] * luma -
          GRADE_CONSTANTS.baseSubtract * base[0]),
    base[1] +
      params.grade *
        (GRADE_CONSTANTS.shadowTint[1] * (1 - luma) +
          GRADE_CONSTANTS.highlightTint[1] * luma -
          GRADE_CONSTANTS.baseSubtract * base[1]),
    base[2] +
      params.grade *
        (GRADE_CONSTANTS.shadowTint[2] * (1 - luma) +
          GRADE_CONSTANTS.highlightTint[2] * luma -
          GRADE_CONSTANTS.baseSubtract * base[2]),
  ];

  const gradedLuma = dot(graded, GRADE_CONSTANTS.luma);
  const desaturated: Rgb = [
    gradedLuma + (graded[0] - gradedLuma) * GRADE_CONSTANTS.desaturation,
    gradedLuma + (graded[1] - gradedLuma) * GRADE_CONSTANTS.desaturation,
    gradedLuma + (graded[2] - gradedLuma) * GRADE_CONSTANTS.desaturation,
  ];
  const curved: Rgb = [
    (desaturated[0] - 0.5) * GRADE_CONSTANTS.contrast + 0.5,
    (desaturated[1] - 0.5) * GRADE_CONSTANTS.contrast + 0.5,
    (desaturated[2] - 0.5) * GRADE_CONSTANTS.contrast + 0.5,
  ];

  const qx = params.uv[0] - 0.5;
  const qy = params.uv[1] - 0.5;
  const vignette = clamp01(
    1 - params.vignette * (qx * qx + qy * qy) * GRADE_CONSTANTS.vignetteScale,
  );
  const grainDelta = (params.grainSample ?? 0) * params.grain;
  return [
    clamp01(curved[0] * vignette + grainDelta),
    clamp01(curved[1] * vignette + grainDelta),
    clamp01(curved[2] * vignette + grainDelta),
  ];
}

/** WCAG 2.1 relative luminance of a LINEAR RGB color (Rec.709 weights). */
export function relativeLuminance(rgb: Rgb): number {
  return dot(rgb, WCAG_LUMA);
}

export function contrastRatio(luminanceA: number, luminanceB: number): number {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Pre-grade WCAG contrast of two sRGB hex colors (convenience for the table). */
export function hexContrast(fg: string, bg: string): number {
  return contrastRatio(
    relativeLuminance(hexToLinearRgb(fg)),
    relativeLuminance(hexToLinearRgb(bg)),
  );
}

/** Post-grade WCAG contrast of two sRGB hex colors at one sampled pixel. */
export function gradedHexContrast(
  fg: string,
  bg: string,
  params: GradeParams,
): number {
  return contrastRatio(
    relativeLuminance(gradeLinear(hexToLinearRgb(fg), params)),
    relativeLuminance(gradeLinear(hexToLinearRgb(bg), params)),
  );
}
