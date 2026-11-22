#!/usr/bin/env node
/**
 * Legal gate B3: every font shipped in dist must have a reachable companion
 * license. `public/fonts/ANTON-OFL.txt` is copied into dist/fonts/ by Vite;
 * this check runs after `npm run build` in CI so a dropped/moved license (or
 * a new woff2 without one) fails the build.
 */
import { access, readdir } from 'node:fs/promises';

const DIST = new URL('../dist/', import.meta.url);
const CANDIDATES = [
  'fonts/ANTON-OFL.txt', // shared OFL for the Anton face
  'fonts/OFL.txt',
];

async function walk(dir, prefix = '') {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await walk(new URL(`${entry.name}/`, dir), relative)));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files.sort();
}

const files = await walk(DIST);
const fonts = files.filter((file) => file.endsWith('.woff2'));
if (fonts.length === 0) {
  console.error('font license check FAILED: no woff2 found in dist/');
  process.exit(1);
}

const reachable = [];
for (const candidate of CANDIDATES) {
  try {
    await access(new URL(candidate, DIST));
    reachable.push(candidate);
  } catch {
    // Not shipped under this name; try the next candidate.
  }
}

const problems = [];
if (reachable.length === 0) {
  problems.push('no font license found in dist/fonts/');
}
for (const font of fonts) {
  const stem = font.replace(/\.woff2$/, '');
  const siblings = [`${stem}-OFL.txt`, `${stem}/OFL.txt`];
  const hasSibling = await Promise.all(
    siblings.map(async (path) => {
      try {
        await access(new URL(path, DIST));
        return true;
      } catch {
        return false;
      }
    }),
  );
  if (!hasSibling.some(Boolean) && reachable.length === 0) {
    problems.push(`${font}: no companion license`);
  }
}

if (problems.length > 0) {
  console.error(`font license check FAILED:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(
  `font license OK: ${fonts.length} woff2 file(s) with reachable license(s): ` +
    reachable.join(', '),
);
