#!/usr/bin/env node
/**
 * Legal gate B1: every file shipped under public/ must have a provenance row
 * in ASSETS.md with all five required fields:
 *   file → source → owner-confirmed workplace asset → license/permission → date
 * ASSETS.md is evidence, not a license grant.
 */
import { readdir, readFile } from 'node:fs/promises';
import { posix } from 'node:path';

const ROOT = new URL('../', import.meta.url);
const PUBLIC_DIR = new URL('public/', ROOT);

async function walk(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(new URL(`${entry.name}/`, dir), relative)));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files.sort();
}

const markdown = await readFile(new URL('ASSETS.md', ROOT), 'utf8');
const rows = markdown
  .split('\n')
  .filter((line) => line.startsWith('|'))
  .map((line) =>
    line
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim()),
  )
  .filter((cells) => cells.length === 5 && !cells[0].startsWith('---'));
// Header + separator are not provenance rows.
const documented = new Map(
  rows
    .filter((cells) => cells[0] !== 'File')
    .map((cells) => [cells[0].replace(/^`|`$/g, ''), cells]),
);

const problems = [];
for (const [file, cells] of documented) {
  if (cells.some((cell) => cell.length === 0)) {
    problems.push(`${file}: every one of the 5 fields must be non-empty`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cells[4])) {
    problems.push(`${file}: date-verified must be YYYY-MM-DD`);
  }
}

const shipped = await walk(PUBLIC_DIR);
for (const file of shipped) {
  if (!documented.has(file)) problems.push(`${file}: missing from ASSETS.md`);
}
for (const file of documented.keys()) {
  if (!shipped.includes(file))
    problems.push(`${file}: listed but not in public/`);
}

if (problems.length > 0) {
  console.error(
    `ASSETS.md provenance check FAILED:\n- ${problems.join('\n- ')}`,
  );
  process.exit(1);
}
console.log(
  `ASSETS.md provenance OK: ${shipped.length} public/ files, 5 fields each.`,
);
