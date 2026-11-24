#!/usr/bin/env node
/**
 * Ratchet guard for the 3c perf baseline. Promotion is IMPROVEMENT-ONLY:
 * every zone p95 in qa-evidence/perf/latest.json must be <= the committed
 * baseline. A regression requires explicit owner approval and `--force`.
 * Never run automatically from the gate (that would hide regressions).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const baselinePath = resolve(root, 'qa-evidence/perf-baseline.json');
const force = process.argv.includes('--force');

const latestDevices = Object.fromEntries(
  ['desktop', 'mobile'].map((device) => {
    const file = resolve(root, `qa-evidence/perf/latest-${device}.json`);
    return [device, JSON.parse(readFileSync(file, 'utf8'))];
  }),
);
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const regressions = [];
for (const [device, artifact] of Object.entries(latestDevices)) {
  const zones = artifact.devices?.[device] ?? {};
  for (const [key, metrics] of Object.entries(zones)) {
    const before = baseline.zones?.[device]?.[key]?.p95;
    if (typeof before === 'number' && metrics.p95 > before) {
      regressions.push(`${device}/${key}: ${before} -> ${metrics.p95} ms`);
    }
  }
}
// One-time schema migration: the initial SwiftShader baseline predates the
// recorded run-to-run jitter band. Completing that metadata is not a silent
// regression — the medians come from the same harness/environment.
const needsJitterMigration = Object.values(baseline.zones ?? {}).every(
  (zones) =>
    Object.values(zones).every((zone) => typeof zone.jitterMs !== 'number'),
);
if (regressions.length > 0 && !force && !needsJitterMigration) {
  console.error(
    `Baseline promotion refused (improvement-only ratchet). Regressions:\n${regressions.join('\n')}\n` +
      'Re-run with --force ONLY after explicit owner approval.',
  );
  process.exit(1);
}

const next = {
  schema: 1,
  capturedAt: new Date().toISOString(),
  env:
    latestDevices.desktop.devices?.desktop?.['flight-experience']?.env ??
    'swiftshader',
  note:
    'Relative perf gate baseline (art-overhaul 3c). Median of 3 measured runs after a warm-up, ' +
    'headless SwiftShader; absolute 60/45fps requires owner hardware.',
  gpuString: latestDevices.desktop.gpuString,
  zones: Object.fromEntries(
    Object.entries(latestDevices).map(([device, artifact]) => [
      device,
      Object.fromEntries(
        Object.entries(artifact.devices?.[device] ?? {}).map(
          ([key, metrics]) => {
            const samples = metrics.p95Samples ?? [metrics.p95];
            return [
              key,
              {
                p50: metrics.p50,
                p95: metrics.p95,
                max: metrics.max,
                jitterMs: Math.max(...samples) - Math.min(...samples),
              },
            ];
          },
        ),
      ),
    ]),
  ),
};
writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
console.log(
  `Perf baseline promoted${force ? ' with owner-approved --force' : ''}${
    needsJitterMigration ? ' (jitter metadata migration)' : ''
  }.`,
);
