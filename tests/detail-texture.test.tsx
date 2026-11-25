/**
 * polish(c) scene-side contracts: in-world detail text is painted from tokens
 * (AA parchment-on-ink), wraps inside the texture bounds, disposes safely, and
 * the page/card planes animate via a damped scalar with no per-frame objects.
 */
import { act } from '@testing-library/react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { CLIMATE_TITLE } from '../src/content/climate';
import { POSTS, postId } from '../src/content/posts';
import { usePortfolioStore } from '../src/state/store';
import { DetailPlane } from '../src/scene/DetailPlane';
import {
  caseDetailSpec,
  climateDetailSpec,
  DETAIL_TEXTURE,
  monitorDetailSpec,
  paintDetailTexture,
  postDetailSpecs,
  stripDetailHtml,
  wrapDetailText,
  type DetailCanvasFactory,
} from '../src/scene/detail-texture';

interface PaintedText {
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
}

function recordingCanvas(): {
  factory: DetailCanvasFactory;
  texts: PaintedText[];
} {
  const texts: PaintedText[] = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    textBaseline: '',
    textAlign: '',
    font: '',
    fillRect: () => {},
    strokeRect: () => {},
    save: () => {},
    restore: () => {},
    fillText(text: string, x: number, y: number) {
      const size = Number(/(\d+)px/.exec(this.font)?.[1] ?? 0);
      texts.push({ text, x, y, size, color: this.fillStyle });
    },
  };
  return {
    texts,
    factory: ((width, height) =>
      ({
        width,
        height,
        getContext: () => ctx,
      }) as unknown as HTMLCanvasElement) as DetailCanvasFactory,
  };
}

const noContextFactory: DetailCanvasFactory = ((width, height) =>
  ({
    width,
    height,
    getContext: () => null,
  }) as unknown as HTMLCanvasElement) as DetailCanvasFactory;

const first = POSTS[0]!;

describe('in-world detail copy', () => {
  it('strips description markup but keeps verbatim words', () => {
    const text = stripDetailHtml(
      'Before <b>bold</b> &amp; <i>italic</i>&nbsp;end',
    );
    expect(text).toBe('Before bold & italic end');
  });

  it('wraps deterministically within the texture width', () => {
    const lines = wrapDetailText('one two three four five six', 10);
    expect(lines).toEqual(['one two', 'three four', 'five six']);
  });

  it('builds stable, distinct specs for every surface with a repo/NDA footer', () => {
    const { cover, body } = postDetailSpecs(first);
    expect(cover.key).toBe(`book-cover:${postId(first)}`);
    expect(body.key).toBe(`book-body:${postId(first)}`);
    expect(caseDetailSpec(first).key).toBe(`case:${postId(first)}`);
    expect(monitorDetailSpec().title).toBeTruthy();
    expect(climateDetailSpec('21°C').lines).toContain('21°C');
    expect(body.footer).toMatch(/Repository is private|http/);
    expect(cover.title).toBe(first.title);
  });
});

describe('paintDetailTexture', () => {
  it('returns null when no 2D context exists (headless fallback)', () => {
    expect(
      paintDetailTexture(postDetailSpecs(first).body, noContextFactory),
    ).toBeNull();
  });

  it('paints token colors only, inside the frame, with an SRGB CanvasTexture', () => {
    const { factory, texts } = recordingCanvas();
    const texture = paintDetailTexture(postDetailSpecs(first).body, factory);
    expect(texture).toBeInstanceOf(THREE.CanvasTexture);
    expect(texture?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texts.length).toBeGreaterThan(3);
    const { width, height, margin } = DETAIL_TEXTURE;
    for (const item of texts) {
      // Every glyph box stays inside the parchment frame with a margin.
      expect(item.x).toBeGreaterThanOrEqual(margin - 2);
      expect(item.y).toBeGreaterThanOrEqual(0);
      expect(item.y + item.size).toBeLessThanOrEqual(height - margin + 2);
      // Anton is condensed (~0.46em); the body stack is ~0.56em.
      const advance = item.size * (item.size >= 36 ? 0.46 : 0.56);
      expect(item.x + item.text.length * advance).toBeLessThanOrEqual(
        width - margin + 2,
      );
      // Token-derived hex only — no ad-hoc palette drift (AA on deep ink).
      expect(item.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
    // polish(c) contrast fix: EVERY painted glyph is lettering on ink
    // (graded-worst 4.23 ≥ 3.9). Gold grades to 2.82 on ink, so it is the
    // non-text frame rule only — never eyebrow/body/footer copy.
    expect(texts.length).toBeGreaterThan(0);
    for (const item of texts) {
      expect(item.color.toUpperCase()).toBe('#F0E8D6');
    }
    expect(texts.some((item) => item.color.toUpperCase() === '#D4B06A')).toBe(
      false,
    );
    texture?.dispose();
  });

  it('truncates long copy with an ellipsis so it never overflows the page', () => {
    const { factory, texts } = recordingCanvas();
    const spec = {
      key: 'overflow',
      eyebrow: 'TEST',
      title: CLIMATE_TITLE,
      lines: Array.from({ length: 60 }, () => 'a long line of detail copy'),
      footer: 'footer',
    };
    const texture = paintDetailTexture(spec, factory);
    expect(texts.some((item) => item.text === '…')).toBe(true);
    texture?.dispose();
  });

  it('keeps the footer clear of the last body line for a two-line title', () => {
    const { factory, texts } = recordingCanvas();
    const texture = paintDetailTexture(
      {
        key: 'two-line-title',
        eyebrow: 'TEST',
        title: 'A Very Long Experience Post Title That Wraps',
        lines: Array.from({ length: 60 }, () => 'a long line of detail copy'),
        footer: 'footer',
      },
      factory,
    );
    // Distinct font sizes make each band identifiable in the recording canvas.
    const titles = texts.filter((item) => item.size === 38);
    const body = texts.filter((item) => item.size === DETAIL_TEXTURE.fontPx);
    const footer = texts.filter((item) => item.size === 18);
    expect(titles).toHaveLength(2);
    expect(body.length).toBeGreaterThan(0);
    expect(body.length).toBeLessThanOrEqual(DETAIL_TEXTURE.maxLines);
    expect(footer).toHaveLength(1);
    const lastBody = body[body.length - 1]!;
    // The body budget shrinks to fit a two-line title; no overlapping glyphs.
    expect(footer[0]!.y - (lastBody.y + lastBody.size)).toBeGreaterThanOrEqual(
      6,
    );
    expect(texts.some((item) => item.text === '…')).toBe(true);
    texture?.dispose();
  });
});

describe('DetailPlane animation + focus highlight', () => {
  it('turns a book page around its left edge with a damped scalar', async () => {
    const { factory } = recordingCanvas();
    const renderer = await ReactThreeTestRenderer.create(
      <DetailPlane
        spec={postDetailSpecs(first).cover}
        position={[0, 0, 0]}
        motion="turn"
        active
        canvasFactory={factory}
      />,
      { frameloop: 'never' },
    );
    const pivot = renderer.scene.find(
      (node) => node.props.name === 'detail-plane-pivot',
    )!;
    expect(pivot.instance.rotation.y).toBe(0);
    act(() => usePortfolioStore.getState().selectPost(postId(first)));
    await renderer.advanceFrames(40, 0.05);
    expect(pivot.instance.rotation.y).toBeLessThan(-2.5);
    await renderer.unmount();
  });

  it('lifts a card into view and shows the F1 focus highlight', async () => {
    const { factory } = recordingCanvas();
    const renderer = await ReactThreeTestRenderer.create(
      <DetailPlane
        spec={caseDetailSpec(first)}
        position={[0, 0, 0]}
        active
        canvasFactory={factory}
      />,
      { frameloop: 'never' },
    );
    const mesh = renderer.scene.find((node) => node.type === 'Mesh')!;
    await renderer.advanceFrames(40, 0.05);
    expect(mesh.instance.scale.x).toBeCloseTo(1, 2);
    expect(mesh.instance.position.y).toBeCloseTo(0, 2);

    act(() => usePortfolioStore.getState().setDetailMirrorFocused(true));
    expect(
      renderer.scene.findAll(
        (node) => node.props.name === 'detail-plane-focus',
      ),
    ).toHaveLength(1);
    act(() => usePortfolioStore.getState().setDetailMirrorFocused(false));
    expect(
      renderer.scene.findAll(
        (node) => node.props.name === 'detail-plane-focus',
      ),
    ).toHaveLength(0);
    await renderer.unmount();
  });

  it('swallows pointer hits so clicks never reach picks behind the plane', async () => {
    const { factory } = recordingCanvas();
    const renderer = await ReactThreeTestRenderer.create(
      <DetailPlane
        spec={caseDetailSpec(first)}
        position={[0, 0, 0]}
        active
        canvasFactory={factory}
        name="case-detail-card"
      />,
      { frameloop: 'never' },
    );
    const plane = renderer.scene
      .findAll((node) => node.type === 'Mesh')
      .find((node) => node.props.name !== 'case-detail-card-focus')!;
    expect(typeof plane.props.onPointerDown).toBe('function');
    expect(typeof plane.props.onClick).toBe('function');
    const stopDown = vi.fn();
    const stopClick = vi.fn();
    plane.props.onPointerDown({ stopPropagation: stopDown });
    plane.props.onClick({ stopPropagation: stopClick });
    expect(stopDown).toHaveBeenCalledTimes(1);
    expect(stopClick).toHaveBeenCalledTimes(1);
    await renderer.unmount();
  });
});
