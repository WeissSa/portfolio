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

  it('uses the P5 red/black/white language', () => {
    expect(JSON.stringify(plan.ops)).toContain('#ff2a1a');
    expect(JSON.stringify(plan.ops)).toContain('#f5f2ea');
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
