/**
 * Pure heatmap drawing (REWORK_PLAN §4.4, commit 9): the single drawing routine
 * behind BOTH the 2D canvas and the 3D projector texture. These tests use a
 * recording 2D context to assert deterministic, palette-aware output — they
 * do NOT verify pixels (that needs a real browser screenshot review).
 */
import { describe, expect, it } from 'vitest';
import type { HeatmapCell } from '../src/lib/climate';
import {
  DEFAULT_HEATMAP_PALETTE,
  drawHeatmap,
  HEATMAP_CELL,
  HEATMAP_LEFT_LABELS,
  HEATMAP_STEP,
  HEATMAP_TOP_LABELS,
  heatmapSize,
} from '../src/lib/climate-draw';

interface RecordedCall {
  method: string;
  args: unknown[];
  fillStyle?: string;
  font?: string;
  textAlign?: string;
}

/** Minimal CanvasRenderingContext2D stand-in that records every draw op. */
function recordingContext() {
  const calls: RecordedCall[] = [];
  const ctx = {
    fillStyle: '',
    font: '',
    textBaseline: '',
    textAlign: 'left',
    clearRect: (...args: unknown[]) =>
      calls.push({ method: 'clearRect', args }),
    fillRect: (...args: unknown[]) =>
      calls.push({ method: 'fillRect', args, fillStyle: ctx.fillStyle }),
    fillText: (...args: unknown[]) =>
      calls.push({
        method: 'fillText',
        args,
        fillStyle: ctx.fillStyle,
        font: ctx.font,
        textAlign: ctx.textAlign,
      }),
    save: () => calls.push({ method: 'save', args: [] }),
    restore: () => calls.push({ method: 'restore', args: [] }),
    translate: (...args: unknown[]) =>
      calls.push({ method: 'translate', args }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const CELLS: HeatmapCell[] = [
  { date: '2024-01-01', level: 3, temp: 2, mean: 2, hottestOnRecord: false },
  { date: '2024-01-02', level: 4, temp: 8, mean: 2, hottestOnRecord: false },
  { date: '2024-02-01', level: 6, temp: 20, mean: 2, hottestOnRecord: true },
  {
    date: '2024-12-31',
    level: 0,
    temp: null,
    mean: null,
    hottestOnRecord: false,
  },
];

describe('drawHeatmap (pure, shared by 2D + 3D)', () => {
  it('emits an identical draw-call sequence for the same cells and year', () => {
    const a = recordingContext();
    const b = recordingContext();
    drawHeatmap(a.ctx, CELLS, 2024);
    drawHeatmap(b.ctx, CELLS, 2024);
    expect(a.calls.length).toBeGreaterThan(10);
    expect(b.calls).toEqual(a.calls);
  });

  it('lays out by Jan 1 weekday, so a different year produces a different draw', () => {
    const a = recordingContext();
    const b = recordingContext();
    // 2024-01-01 is a Monday; 2025-01-01 is a Wednesday.
    drawHeatmap(a.ctx, CELLS, 2024);
    drawHeatmap(b.ctx, CELLS, 2025);
    expect(b.calls).not.toEqual(a.calls);
  });

  it('applies the supplied palette to the background, labels and cells', () => {
    const recorder = recordingContext();
    drawHeatmap(recorder.ctx, CELLS, 2024, {
      colors: [
        '#000000',
        '#111111',
        '#222222',
        '#333333',
        '#444444',
        '#555555',
        '#666666',
      ],
      text: '#abcdef',
      background: '#fff0dd',
    });
    expect(recorder.calls[0]).toMatchObject({
      method: 'clearRect',
    });
    expect(recorder.calls[1]).toMatchObject({
      method: 'fillRect',
      args: [0, 0, expect.any(Number), expect.any(Number)],
      fillStyle: '#fff0dd',
    });
    const labels = recorder.calls.filter((call) => call.method === 'fillText');
    expect(labels[0]?.fillStyle).toBe('#abcdef');
    expect(labels[0]?.textAlign).toBe('left');
    const cellRects = recorder.calls.filter(
      (call) =>
        call.method === 'fillRect' &&
        call.args[2] === HEATMAP_CELL &&
        call.args[3] === HEATMAP_CELL,
    );
    expect(cellRects).toHaveLength(CELLS.length);
    expect(cellRects.map((call) => call.fillStyle)).toContain('#333333'); // level 3
    expect(cellRects.map((call) => call.fillStyle)).toContain('#666666'); // level 6
  });

  it('uses the DOM palette by default and reports its native size', () => {
    const recorder = recordingContext();
    drawHeatmap(recorder.ctx, CELLS, 2024);
    expect(DEFAULT_HEATMAP_PALETTE.text).toBe('#ffffff');
    const size = heatmapSize(CELLS, 2024);
    // Jan 1 2024 = Monday (1) → one week column for four sparse cells.
    expect(size).toEqual({
      width: HEATMAP_LEFT_LABELS + HEATMAP_STEP,
      height: HEATMAP_TOP_LABELS + 7 * HEATMAP_STEP,
    });
  });
});
