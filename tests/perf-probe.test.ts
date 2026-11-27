/**
 * Frame-time sampler helpers (commit 3c). The probe is TEST-ONLY and is never
 * imported by app code, so these assertions add no production bytes.
 */
import { describe, expect, it } from 'vitest';
import {
  installPerfProbe,
  percentile,
  summarize,
  type PerfReport,
} from '../src/lib/perf-probe';

describe('frame-time math', () => {
  it('median/p95/max use nearest-rank percentiles', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2);
    expect(percentile([1, 2, 3, 4], 0.95)).toBe(4);
    expect(percentile([], 0.5)).toBe(0);
    const summary = summarize([8, 1, 4, 2, 16]);
    expect(summary).toEqual({ n: 5, p50: 4, p95: 16, max: 16 });
    expect(summarize([])).toEqual({ n: 0, p50: 0, p95: 0, max: 0 });
  });
});

describe('window.__perf harness', () => {
  it('installs a singleton with start/stop/report and a separated raf metric', () => {
    const api = installPerfProbe(window);
    expect(installPerfProbe(window)).toBe(api);
    expect(window.__perf).toBe(api);
    expect(typeof api.start).toBe('function');
    expect(typeof api.stop).toBe('function');
    const report: PerfReport = api.report();
    expect(report.n).toBe(0);
    expect(report.longFrames).toBe(0);
    expect(report.raf.n).toBe(0);
    expect(report.gpu).toBeNull();
    api.start('test-workload');
    api.stop();
    expect(api.report().label).toBe('test-workload');
  });
});
