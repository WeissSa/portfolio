/**
 * CSS-side companion to eslint-no-raw-hex.mjs: ESLint cannot parse .css files,
 * so this guard enforces the same rule for stylesheets.
 *
 * Rules:
 *   1. No raw hex literal may appear OUTSIDE a `:root { ... }` block — every
 *      color used in a rule must be a `var(--p5-*)` reference.
 *   2. Every hex literal INSIDE `:root` must equal a value from the canonical
 *      design-tokens.json store (no unapproved color smuggled in as a var).
 *
 * The index.html `<style data-critical-mirror>` block is explicitly
 * allowlisted (it is the dev-only first-paint mirror, kept byte-stable and
 * parity-tested against static-mirror.css by tests/critical-css-parity.test.ts).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HEX_COLOR = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b/gi;
const ROOT_BLOCK = /:root\s*\{[^{}]*\}/gi;

/** Strip CSS comments so commented-out hex examples cannot trip the guard. */
export function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** All raw hex literals in a stylesheet outside of `:root` declarations. */
export function findRawHexOutsideRoot(css) {
  const body = stripCssComments(css).replace(ROOT_BLOCK, '');
  return body.match(HEX_COLOR) ?? [];
}

/** Hex literals inside `:root` that are not canonical token values. */
export function findNonTokenRootHex(css, allowedValues) {
  const roots = stripCssComments(css).match(ROOT_BLOCK) ?? [];
  const allowed = new Set(allowedValues.map((v) => v.toLowerCase()));
  const offenders = [];
  for (const block of roots) {
    for (const hex of block.match(HEX_COLOR) ?? []) {
      if (!allowed.has(hex.toLowerCase())) offenders.push(hex);
    }
  }
  return offenders;
}

function canonicalValues() {
  const url = new URL('../src/styles/design-tokens.json', import.meta.url);
  const tokens = JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
  return Object.values(tokens).flatMap((group) =>
    Array.isArray(group) ? group : Object.values(group),
  );
}

function main() {
  const allowed = canonicalValues();
  const stylesDir = fileURLToPath(new URL('../src/styles/', import.meta.url));
  const problems = [];
  for (const file of readdirSync(stylesDir).filter((f) => f.endsWith('.css'))) {
    const css = readFileSync(`${stylesDir}${file}`, 'utf8');
    for (const hex of findRawHexOutsideRoot(css)) {
      problems.push(`${file}: raw hex "${hex}" outside :root`);
    }
    for (const hex of findNonTokenRootHex(css, allowed)) {
      problems.push(`${file}: :root hex "${hex}" is not a canonical token`);
    }
  }
  if (problems.length) {
    console.error('CSS color guard failed:\n' + problems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('CSS color guard: all stylesheet hex is token-backed.');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
