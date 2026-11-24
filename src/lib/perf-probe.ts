/**
 * In-page frame-time sampler (art-overhaul commit 3c). DEV/TEST ONLY: no app
 * module imports this file, so it ships ZERO production bytes. Playwright
 * injects a transpiled copy with addInitScript() to install `window.__perf`.
 *
 * METRIC: the primary p50/p95/max are the per-frame WORKLOAD (main-thread time
 * between the previous frame's end and this frame's start, plus GPU timer-query
 * time when EXT_disjoint_timer_query_webgl2 exists), NOT the rAF interval.
 * Raw rAF deltas are reported separately under `raf` so jank vs. idle is
 * distinguishable. `longFrames` counts workload samples over 34 ms (<30fps).
 *
 * Usage: __perf.start('flight-home'); …drive workload…; __perf.stop(); __perf.report()
 */
export interface PerfSummary {
  n: number;
  p50: number;
  p95: number;
  max: number;
}

export interface PerfReport extends PerfSummary {
  longFrames: number;
  /** Raw frame intervals — informational, NOT the perf gate metric. */
  raf: PerfSummary;
  /** Async GPU time; null when the extension or context is unavailable. */
  gpu: PerfSummary | null;
  /** Workload buckets: ≤8ms, ≤16ms, ≤33ms, ≤50ms, >50ms. */
  histogram: [number, number, number, number, number];
  env: 'swiftshader' | 'hardware' | 'unknown';
  label: string | null;
}

interface Sample {
  main: number;
  delta: number;
  gpu: number | null;
}

/** Nearest-rank percentile of a non-empty sorted numeric array. */
export function percentile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]!;
}

export function summarize(values: readonly number[]): PerfSummary {
  if (values.length === 0) {
    return { n: 0, p50: 0, p95: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1]!,
  };
}

interface GpuTimer {
  gl: WebGL2RenderingContext;
  ext: {
    TIME_ELAPSED_EXT: number;
    GPU_DISJOINT_EXT: number;
  };
  pending: WebGLQuery[];
  active: WebGLQuery | null;
}

function findGpuTimer(): GpuTimer | null {
  const canvas = document.querySelector('canvas');
  const gl = canvas?.getContext('webgl2') as WebGL2RenderingContext | null;
  if (!gl) return null;
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as
    | GpuTimer['ext']
    | null;
  if (!ext) return null;
  return { gl, ext, pending: [], active: null };
}

function readGpu(timer: GpuTimer): number | null {
  if (timer.gl.getParameter(timer.ext.GPU_DISJOINT_EXT)) {
    // A disjoint invalidate makes in-flight timings meaningless.
    for (const query of timer.pending) timer.gl.deleteQuery(query);
    timer.pending.length = 0;
    return null;
  }
  let result: number | null = null;
  for (let i = 0; i < timer.pending.length; i += 1) {
    const query = timer.pending[i]!;
    if (!timer.gl.getQueryParameter(query, timer.gl.QUERY_RESULT_AVAILABLE)) {
      continue;
    }
    result = timer.gl.getQueryParameter(query, timer.gl.QUERY_RESULT) / 1e6;
    timer.gl.deleteQuery(query);
    timer.pending.splice(i, 1);
    i -= 1;
  }
  return result;
}

function gpuName(): string {
  try {
    const gl = document
      .querySelector('canvas')
      ?.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return 'none';
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return String(
      debug
        ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
    );
  } catch {
    return 'unknown';
  }
}

export interface PerfApi {
  start: (label?: string) => void;
  stop: () => void;
  report: () => PerfReport;
  readonly gpuString: string;
  readonly env: PerfReport['env'];
}

export function installPerfProbe(target: Window = window): PerfApi {
  if (target.__perf) return target.__perf;
  let samples: Sample[] = [];
  let label: string | null = null;
  let running = false;
  let rafId = 0;
  let lastFrame = 0;
  let workStart = performance.now();
  // Discovered at start(), not install(): the init script runs before the
  // app's <canvas> exists, and querying then would find no WebGL2 context.
  let timer: GpuTimer | null = null;
  let rendererName = 'uninitialized';
  let env: PerfReport['env'] = 'unknown';
  function discover(): void {
    if (rendererName !== 'uninitialized') return;
    timer = findGpuTimer();
    rendererName = gpuName();
    env = /swiftshader|software/i.test(rendererName)
      ? 'swiftshader'
      : rendererName === 'none' || rendererName === 'unknown'
        ? 'unknown'
        : 'hardware';
  }

  // Signal the END of a frame on a microtask-ish task after the rAF callback.
  // At the next rAF, (now - workStart) measures main-thread work done between
  // frames (R3F render + layout + handlers), excluding the browser's idle time.
  const channel = new MessageChannel();
  channel.port1.onmessage = () => {
    workStart = performance.now();
  };

  function frame(now: number): void {
    if (!running) return;
    const delta = lastFrame === 0 ? 0 : now - lastFrame;
    lastFrame = now;
    const main = Math.max(0, now - workStart);

    let gpu: number | null = null;
    if (timer) {
      if (timer.active) {
        timer.gl.endQuery(timer.ext.TIME_ELAPSED_EXT);
        timer.pending.push(timer.active);
        timer.active = null;
      }
      gpu = readGpu(timer);
      const query = timer.gl.createQuery();
      if (query) {
        timer.gl.beginQuery(timer.ext.TIME_ELAPSED_EXT, query);
        timer.active = query;
      }
    }

    samples.push({ main, delta, gpu });
    channel.port2.postMessage(0);
    rafId = requestAnimationFrame(frame);
  }

  const api: PerfApi = {
    start(nextLabel = 'workload') {
      if (running) api.stop();
      discover();
      samples = [];
      label = nextLabel;
      running = true;
      lastFrame = 0;
      workStart = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(rafId);
      if (timer?.active) {
        // Close the last query so later probes are not left inside a query.
        timer.gl.endQuery(timer.ext.TIME_ELAPSED_EXT);
        timer.pending.push(timer.active);
        timer.active = null;
      }
      // Drain any GPU results that became available at the end of the segment.
      if (timer) readGpu(timer);
    },
    report() {
      const main = samples.map((sample) => sample.main);
      const stats = summarize(main);
      const gpuValues = samples
        .map((sample) => sample.gpu)
        .filter(
          (value): value is number => value !== null && Number.isFinite(value),
        );
      return {
        ...stats,
        longFrames: main.filter((value) => value > 34).length,
        raf: summarize(samples.map((sample) => sample.delta)),
        gpu: gpuValues.length > 0 ? summarize(gpuValues) : null,
        histogram: main.reduce<[number, number, number, number, number]>(
          (buckets, value) => {
            buckets[
              value <= 8
                ? 0
                : value <= 16
                  ? 1
                  : value <= 33
                    ? 2
                    : value <= 50
                      ? 3
                      : 4
            ] += 1;
            return buckets;
          },
          [0, 0, 0, 0, 0],
        ),
        env,
        label,
      };
    },
    get gpuString() {
      return rendererName;
    },
    get env() {
      return env;
    },
  };
  Object.defineProperty(target, '__perf', { value: api, configurable: true });
  return api;
}

declare global {
  interface Window {
    __perf?: PerfApi;
  }
}

// Self-install when injected by the QA harness; harmless if a test imports the
// pure helpers only (there is no app-side import of this module).
if (typeof window !== 'undefined') installPerfProbe(window);
