#!/usr/bin/env node
/**
 * Lazy-chunk size budgets (REWORK_PLAN §3.8; bucketed in art-overhaul commit 0).
 *
 * Chunks in dist/assets are bucketed BY NAME, never by "anything that is not
 * the shell is 3D":
 *
 *   - `index-*.js`  → app shell (gated by the size-limit config in
 *                     package.json, not here)
 *   - `Room-*.js`   → the lazy 3D scene bundle, hard-gated by the bucket's
 *                     brotli limit (plan §3.8)
 *   - anything else → UNBUCKETED: this check FAILS LOUDLY. A Vite rename must
 *                     not silently disable the scene gate with green CI; a
 *                     future lazy UI/asset chunk gets its own named bucket and
 *                     limit here first.
 *
 * Measurement: size-limit's brotli metric is the hard gate (the same tooling
 * and metric used by the shell budget). gzip is reported for §3.8 context but
 * not gated — brotli is this repo's enforced compression metric.
 */
import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const LIMIT_BYTES = 260 * 1000; // "~260 KB" per plan §3.8
const ASSETS_DIR = 'dist/assets';
// Resolve the size-limit binary next to THIS script. Tests run the check from
// a minimal temporary package directory with their own `package.json`, so the
// binary cannot be resolved relative to the process cwd.
const SIZE_LIMIT_BIN = fileURLToPath(
  new URL('../node_modules/size-limit/bin.js', import.meta.url),
);

/** Named chunk buckets — add a bucket here when a new lazy split lands. */
const BUCKETS = [
  {
    name: '3d-scene',
    pattern: /^Room-[^/]*\.js$/,
    limit: `${LIMIT_BYTES / 1000} KB`,
  },
];

let names = [];
try {
  names = await readdir(ASSETS_DIR);
} catch {
  names = [];
}

const jsChunks = names.filter((name) => name.endsWith('.js')).sort();
const isShell = (name) => name.startsWith('index-');
const bucketOf = (name) =>
  BUCKETS.find((bucket) => bucket.pattern.test(name)) ?? null;

const unbucketed = jsChunks.filter((n) => !isShell(n) && bucketOf(n) === null);
if (unbucketed.length > 0) {
  console.error(
    `ERROR unbucketed lazy chunk(s): ${unbucketed.join(', ')}. ` +
      `Add a named bucket (with its own brotli limit) in ` +
      `scripts/check-3d-budget.mjs before shipping a new split — otherwise a ` +
      `renamed 3D chunk could bypass the scene budget unnoticed.`,
  );
  process.exit(1);
}

let failed = false;
for (const bucket of BUCKETS) {
  const chunks = jsChunks.filter((name) => bucketOf(name) === bucket);
  if (chunks.length === 0) {
    console.log(
      `${bucket.name} chunk budget: no matching chunk emitted yet — deferred ` +
        `(limit ${bucket.limit} compressed).`,
    );
    continue;
  }

  const files = chunks.map((name) => `${ASSETS_DIR}/${name}`);
  let gzipTotal = 0;
  for (const file of files) {
    gzipTotal += gzipSync(await readFile(file), { level: 9 }).length;
  }

  console.log(
    `${bucket.name} chunk(s): ${chunks.join(', ')}\n` +
      `  gzip total (informational): ${gzipTotal} B`,
  );

  // Hard gate: size-limit brotli, matching the shell budget's metric.
  const result = spawnSync(
    process.execPath,
    [SIZE_LIMIT_BIN, ...files, '--limit', bucket.limit],
    { stdio: 'inherit' },
  );
  if ((result.status ?? 1) !== 0) {
    console.error(
      `${bucket.name} chunk budget EXCEEDED (limit ${bucket.limit} brotli; ` +
        `plan §3.8 hard gate is ${LIMIT_BYTES / 1000} KB).`,
    );
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
