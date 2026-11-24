/**
 * Procedural texture PLAN tests (§4.3): determinism + budgets. Plans are pure
 * data, so this runs headlessly; the canvas execution layer (paintPlanToCanvas
 * / createPlanTexture) needs a real browser 2D context and is covered by
 * visual verification instead (see PR notes).
 */
import { describe, expect, it } from 'vitest';
import {
  createTexturePlans,
  MAX_TEXTURE_OPS,
  MAX_TEXTURE_SIZE,
  paintPlanToCanvas,
  planBookSpineAtlas,
  planBrass,
  planCaseLabels,
  planMonitorDesktop,
  planPaper,
  planPlaster,
  planProjectorScreen,
  planRug,
  planWood,
  type PaintOp,
  type TexturePlan,
} from '../src/scene/art/textures';
import { POSTS, PROJECTS } from '../src/content/index';
import { PALETTE } from '../src/scene/art/palette';

const fingerprint = (plan: TexturePlan): string => JSON.stringify(plan.ops);
const textOps = (plan: TexturePlan): Extract<PaintOp, { kind: 'text' }>[] =>
  plan.ops.filter(
    (op): op is Extract<PaintOp, { kind: 'text' }> => op.kind === 'text',
  );

const CONTENT = {
  books: POSTS.map((post) => ({ title: post.title, featured: post.featured })),
  cases: PROJECTS.map((project) => project.title),
};

describe('texture plan determinism', () => {
  it('same seed → byte-identical plans for every texture', () => {
    const a = createTexturePlans('the-room', CONTENT);
    const b = createTexturePlans('the-room', CONTENT);
    for (const key of Object.keys(a) as (keyof typeof a)[]) {
      expect(fingerprint(a[key])).toBe(fingerprint(b[key]));
      expect(a[key].width).toBe(b[key].width);
      expect(a[key].height).toBe(b[key].height);
    }
  });

  it('different seed → different painterly plans', () => {
    const a = createTexturePlans('seed-a', CONTENT);
    const b = createTexturePlans('seed-b', CONTENT);
    expect(fingerprint(a.wood)).not.toBe(fingerprint(b.wood));
    expect(fingerprint(a.plaster)).not.toBe(fingerprint(b.plaster));
    expect(fingerprint(a.rug)).not.toBe(fingerprint(b.rug));
  });

  it('each generator is stable in isolation', () => {
    expect(fingerprint(planWood('x'))).toBe(fingerprint(planWood('x')));
    expect(fingerprint(planPlaster('x'))).toBe(fingerprint(planPlaster('x')));
    expect(fingerprint(planBrass('x'))).toBe(fingerprint(planBrass('x')));
    expect(fingerprint(planPaper('x'))).toBe(fingerprint(planPaper('x')));
    expect(fingerprint(planRug('x'))).toBe(fingerprint(planRug('x')));
    expect(fingerprint(planMonitorDesktop('x'))).toBe(
      fingerprint(planMonitorDesktop('x')),
    );
    expect(fingerprint(planProjectorScreen('x'))).toBe(
      fingerprint(planProjectorScreen('x')),
    );
  });
});

describe('texture budgets (§3.8/§4.3)', () => {
  const plans = createTexturePlans('budget', CONTENT);

  it('every texture stays within the size cap', () => {
    for (const plan of Object.values(plans)) {
      expect(plan.width).toBeLessThanOrEqual(MAX_TEXTURE_SIZE);
      expect(plan.height).toBeLessThanOrEqual(MAX_TEXTURE_SIZE);
    }
  });

  it('op counts stay paintable in one frame-budget pass', () => {
    for (const plan of Object.values(plans)) {
      expect(plan.ops.length).toBeGreaterThan(0);
      expect(plan.ops.length).toBeLessThanOrEqual(MAX_TEXTURE_OPS);
    }
  });

  it('total texture pixels stay under the scene GPU-memory cap (3a)', () => {
    // Nine plans at ≤512px each: the SUM is capped so a future plan cannot
    // sneak a second 512² atlas in under the per-texture size limit.
    let totalPixels = 0;
    for (const plan of Object.values(plans)) {
      totalPixels += plan.width * plan.height;
    }
    expect(totalPixels).toBeGreaterThan(0);
    expect(totalPixels).toBeLessThanOrEqual(1_800_000);
  });

  it('painterly surfaces bake in edge darkening (§3.5)', () => {
    for (const plan of [
      plans.wood,
      plans.plaster,
      plans.brass,
      plans.paper,
      plans.rug,
    ]) {
      expect(plan.ops.some((op) => op.kind === 'vignette')).toBe(true);
    }
  });

  it('rich plans paint curved brush strokes via the Bézier op (3b)', () => {
    const curveCount = (plan: TexturePlan): number =>
      plan.ops.filter((op) => op.kind === 'curve').length;
    // Wood: 3 grain swirls per plank × 4 planks; plaster: curved cracks
    // (4 × 6 segments) + 12 trowel strokes; brass: 10 edge-wear arcs.
    expect(curveCount(plans.wood)).toBeGreaterThanOrEqual(8);
    expect(curveCount(plans.plaster)).toBeGreaterThanOrEqual(20);
    expect(curveCount(plans.brass)).toBeGreaterThanOrEqual(8);
    // The richer plans still respect the op budget (asserted above too).
    for (const plan of [plans.wood, plans.plaster, plans.brass]) {
      expect(plan.ops.length).toBeLessThanOrEqual(MAX_TEXTURE_OPS);
    }
  });

  it('every plan starts with an opaque base fill', () => {
    for (const plan of Object.values(plans)) {
      expect(plan.ops[0]?.kind).toBe('fill');
    }
  });
});

describe('book spine atlas', () => {
  const books = [
    { title: 'Gusto - Software Engineer', featured: true },
    { title: 'Mabin', featured: false },
    {
      title: 'An Extremely Long Legacy Project Title For Truncation',
      featured: false,
    },
  ];
  const atlas = planBookSpineAtlas('atlas', books);

  it('renders one spine label per book', () => {
    const labels = textOps(atlas).map((op) => op.text);
    expect(labels).toContain('★ Gusto - Software Engineer');
    expect(labels).toContain('Mabin');
  });

  it('marks featured volumes with a star', () => {
    expect(textOps(atlas).some((op) => op.text.startsWith('★'))).toBe(true);
  });

  it('truncates overlong titles deterministically', () => {
    const long = textOps(atlas).find((op) => op.text.includes('Extremely'));
    expect(long).toBeDefined();
    expect(long?.text.endsWith('…')).toBe(true);
    expect(long?.text.length ?? 99).toBeLessThanOrEqual(30);
  });
});

describe('game case labels', () => {
  const plan = planCaseLabels('cases', CONTENT.cases);

  it('includes a recognizable label line for every project', () => {
    const labels = textOps(plan).map((op) => op.text);
    for (const title of CONTENT.cases) {
      const firstWord = title.split(' ')[0] ?? '';
      expect(
        labels.some((text) => text.includes(firstWord)),
        `expected a label containing "${firstWord}"`,
      ).toBe(true);
    }
  });

  it('uses the tokenized P5 accent/parchment language', () => {
    // Commit 2 recolors P5 red → brass and P5 white → parchment; assert the
    // plan derives those colors from the canonical tokens rather than pinning
    // the old hexes (a future palette change must not need a test edit).
    expect(JSON.stringify(plan.ops)).toContain(PALETTE.p5Red);
    expect(JSON.stringify(plan.ops)).toContain(PALETTE.p5White);
  });
});

describe('monitor + projector screens', () => {
  it('monitor preview shows the samOS desktop promise', () => {
    const labels = textOps(planMonitorDesktop('m')).map((op) => op.text);
    expect(labels).toContain('★ samOS');
    expect(labels.some((text) => text.includes('bio.txt'))).toBe(true);
  });

  it('projector screen carries the climate title card', () => {
    const labels = textOps(planProjectorScreen('p')).map((op) => op.text);
    expect(labels).toContain('OUR CLIMATE,');
    expect(labels).toContain('OUR FUTURE');
    expect(labels.some((text) => text.includes('open-meteo.com'))).toBe(true);
  });
});

describe('curve paint op (art-overhaul commit 3a)', () => {
  /**
   * paintPlanToCanvas needs a 2D context; jsdom has none. The op execution is
   * verified against a recording stub so the quadratic-vs-cubic branch is
   * covered headlessly (pixel fidelity stays a browser/QA concern).
   */
  function recordingCanvas() {
    const calls: Array<[string, ...number[]]> = [];
    const record =
      (name: string) =>
      (...args: number[]) =>
        calls.push([name, ...args]);
    const ctx = {
      save: record('save') as () => void,
      restore: record('restore') as () => void,
      beginPath: record('beginPath') as () => void,
      moveTo: record('moveTo'),
      lineTo: record('lineTo'),
      quadraticCurveTo: record('quadraticCurveTo'),
      bezierCurveTo: record('bezierCurveTo'),
      stroke: record('stroke') as () => void,
      fill: record('fill') as () => void,
      fillRect: record('fillRect'),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      lineCap: 'butt',
      globalAlpha: 1,
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;
    return { canvas, calls };
  }

  const planWith = (op: PaintOp): TexturePlan => ({
    name: 'curve-test',
    width: 8,
    height: 8,
    ops: [op],
  });

  it('paints a quadratic stroke with one control point', () => {
    const { canvas, calls } = recordingCanvas();
    paintPlanToCanvas(
      planWith({
        kind: 'curve',
        x1: 1,
        y1: 2,
        cx1: 3,
        cy1: 4,
        x2: 5,
        y2: 6,
        width: 2,
        color: PALETTE.brass,
      }),
      canvas,
    );
    expect(calls).toContainEqual(['moveTo', 1, 2]);
    expect(calls).toContainEqual(['quadraticCurveTo', 3, 4, 5, 6]);
    expect(calls.some(([name]) => name === 'bezierCurveTo')).toBe(false);
    expect(calls.some(([name]) => name === 'stroke')).toBe(true);
  });

  it('upgrades to a cubic Bézier when both control points are given', () => {
    const { canvas, calls } = recordingCanvas();
    paintPlanToCanvas(
      planWith({
        kind: 'curve',
        x1: 0,
        y1: 0,
        cx1: 1,
        cy1: 2,
        cx2: 3,
        cy2: 4,
        x2: 5,
        y2: 5,
        width: 1.5,
        color: PALETTE.woodGrain,
      }),
      canvas,
    );
    expect(calls).toContainEqual(['bezierCurveTo', 1, 2, 3, 4, 5, 5]);
    expect(calls.some(([name]) => name === 'quadraticCurveTo')).toBe(false);
  });
});
