#!/usr/bin/env node
/**
 * Legal gate M4: franchise names may live only in gitignored docs and code
 * COMMENTS — never in index.html's head/SEO copy, README marketing copy,
 * src/content (all rendered copy/SEO constants), or public/404.html.
 *
 * Internal CSS identifiers such as `--p5-red` are code, not marketing copy:
 * they are stripped from index.html together with <style>/<script> blocks.
 */
import { readdir, readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const FORBIDDEN = [
  { label: 'Dishonored', pattern: /\bdishonored\b/i },
  { label: 'Persona 5', pattern: /\bpersona\s*5\b/i },
  { label: 'Persona', pattern: /\bpersona\b/i },
  { label: 'P5', pattern: /\bP5\b/ },
];

async function filesIn(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      found.push(...(await filesIn(new URL(`${entry.name}/`, dir), relative)));
    } else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) {
      found.push(relative);
    }
  }
  return found;
}

function marketingText(text, isHtml) {
  if (!isHtml) return text;
  // Head/SEO text only: CSS custom properties and script identifiers are code.
  return text
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');
}

const targets = [
  { file: 'README.md', html: false },
  { file: 'index.html', html: true },
  { file: 'public/404.html', html: true },
  ...(await filesIn(new URL('src/content/', ROOT))).map((file) => ({
    file: `src/content/${file}`,
    html: false,
  })),
];

const problems = [];
for (const target of targets) {
  const text = marketingText(
    await readFile(new URL(target.file, ROOT), 'utf8'),
    target.html,
  );
  for (const { label, pattern } of FORBIDDEN) {
    if (pattern.test(text)) {
      problems.push(
        `${target.file}: franchise name "${label}" in marketing/SEO text`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`Trademark guard FAILED:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`Trademark guard OK: ${targets.length} marketing/SEO files clean.`);
