#!/usr/bin/env node
/**
 * Lazy 3D scene chunk budget (REWORK_PLAN §3.8): every JS chunk in
 * dist/assets OTHER than the shell entry (index-*.js) belongs to the lazy 3D
 * bundle (scene code-split) and must together stay within 260 KB compressed.
 *
 * Until the scene is actually lazy-loaded (ladder commit 5 wires Room into the
 * app), no such chunk exists and this check reports "deferred" and passes —
 * the budget starts biting the moment the split lands, as required.
 *
 * Measurement: size-limit's brotli metric is the hard gate (the same tooling
 * and metric used by the shell budget). gzip is reported for §3.8 context but
 * not gated — brotli is this repo's enforced compression metric.
 */
import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

const LIMIT_BYTES = 260 * 1000; // "~260 KB" per plan §3.8
const ASSETS_DIR = 'dist/assets';

let names = [];
try {
  names = await readdir(ASSETS_DIR);
} catch {
  names = [];
}

const chunks = names
  .filter((name) => name.endsWith('.js') && !name.startsWith('index-'))
  .sort();

if (chunks.length === 0) {
  console.log(
    `3D scene chunk budget: no lazy chunk emitted yet — deferred until the ` +
      `scene is code-split (limit ${LIMIT_BYTES / 1000} KB compressed).`,
  );
  process.exit(0);
}

const files = chunks.map((name) => `${ASSETS_DIR}/${name}`);
let gzipTotal = 0;
for (const file of files) {
  gzipTotal += gzipSync(await readFile(file), { level: 9 }).length;
}

console.log(
  `3D scene chunk(s): ${chunks.join(', ')}\n` +
    `  gzip total (informational): ${gzipTotal} B`,
);

// Hard gate: size-limit brotli ≤ 260 KB, matching the shell budget's metric.
const result = spawnSync(
  process.execPath,
  ['node_modules/size-limit/bin.js', ...files, '--limit', '260 KB'],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
