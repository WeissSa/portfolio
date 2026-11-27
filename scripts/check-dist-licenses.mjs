#!/usr/bin/env node
/**
 * Legal gate B3: EVERY font shipped in dist must have its own companion
 * license, unless it is in an explicitly-approved list covered by a shared
 * license file. The previous implementation only required a sibling license
 * when NO shared license was reachable — once dist/fonts/ANTON-OFL.txt existed
 * that condition was always false, so a new unlicensed woff2 passed silently.
 *
 * `checkFontLicenses(distFiles)` is pure so tests can simulate extra fonts.
 */
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DIST = new URL('../dist/', import.meta.url);

/** Shared license files that can cover only the explicitly-listed fonts below. */
export const SHARED_LICENSE_FILES = ['fonts/ANTON-OFL.txt', 'fonts/OFL.txt'];

/**
 * The Anton face is the sole approved exception: its SIL OFL 1.1 text ships as
 * dist/fonts/ANTON-OFL.txt. Vite hashes emitted asset filenames, so both the
 * hashed (`assets/anton-latin-400-normal-<hash>.woff2`) and unhashed forms are
 * listed. Any OTHER font needs its own sibling license.
 */
export const SHARED_OFL_APPROVED_FONTS = [
  /^(?:assets|fonts)\/anton-latin-[^/]+\.woff2$/,
];

/**
 * @param {readonly string[]} files paths relative to dist/
 * @returns {string[]} one message per unlicensed font (empty = pass)
 */
export function checkFontLicenses(files) {
  const present = new Set(files);
  const fonts = files.filter((file) => file.endsWith('.woff2'));
  if (fonts.length === 0) return ['no woff2 found in dist/'];

  const hasSharedOfl = SHARED_LICENSE_FILES.some((file) => present.has(file));
  const problems = [];
  for (const font of fonts) {
    const stem = font.replace(/\.woff2$/, '');
    const hasSibling =
      present.has(`${stem}-OFL.txt`) || present.has(`${stem}/OFL.txt`);
    const sharedApproved =
      hasSharedOfl &&
      SHARED_OFL_APPROVED_FONTS.some((pattern) => pattern.test(font));
    if (!hasSibling && !sharedApproved) {
      problems.push(`${font}: no companion license`);
    }
  }
  return problems;
}

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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = await walk(DIST);
  const problems = checkFontLicenses(files);
  if (problems.length > 0) {
    console.error(`font license check FAILED:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(
    `font license OK: ${files.filter((f) => f.endsWith('.woff2')).length} woff2 file(s), each with a sibling license or an approved shared OFL.`,
  );
}
