/**
 * Fixtures for the CSS-side color guard (the ESLint rule cannot parse .css).
 * Valid: token vars in rules and canonical hex in :root. Invalid: raw hex in
 * a normal rule, or a non-canonical hex introduced inside :root.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  canonicalValues,
  findNonTokenRootHex,
  findRawHexOutsideRoot,
  stripCssComments,
} from '../scripts/css-hex-guard.mjs';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('CSS color guard', () => {
  it('accepts var() references in rules and ignores comments', () => {
    expect(
      findRawHexOutsideRoot(
        ':root { --brand: #ff0000; }\n.a{color:var(--brand)}',
      ),
    ).toEqual([]);
    expect(findRawHexOutsideRoot('/* #ff0000 is old */ .a{color:red}')).toEqual(
      [],
    );
    expect(stripCssComments('a{color:red}/*x*/')).toBe('a{color:red}');
  });

  it('detects raw 3/6/8-digit hex outside :root', () => {
    expect(
      findRawHexOutsideRoot('.a{color:#fff;border:1px solid #11223344}'),
    ).toEqual(['#fff', '#11223344']);
    expect(findRawHexOutsideRoot('.a{color:#abcdef}')).toEqual(['#abcdef']);
  });

  it('rejects non-canonical hex inside :root', () => {
    expect(
      findNonTokenRootHex(':root{--brand:#ff0000;--ok:#00ff00}', ['#00ff00']),
    ).toEqual(['#ff0000']);
  });

  it('finds no offenders in the real stylesheets', () => {
    // Mirror the guard exactly: derive the allowlist from ALL groups of the raw
    // design-tokens.json (colors plus the width/size scales), not just the
    // groups re-exported by the TS module. A pinned fixture would go stale on
    // the next recolor.
    const allowed = canonicalValues(
      JSON.parse(read('../src/styles/design-tokens.json')),
    );
    for (const file of [
      'p5.css',
      'index.css',
      'static-mirror.css',
      'fonts.css',
    ]) {
      const css = read(`../src/styles/${file}`);
      expect(findRawHexOutsideRoot(css), file).toEqual([]);
      expect(findNonTokenRootHex(css, allowed), file).toEqual([]);
    }
  });

  it('canonicalValues() reads every JSON group and filters non-string leaves', () => {
    const values = canonicalValues(
      JSON.parse(read('../src/styles/design-tokens.json')),
    );
    // ALL groups, not just the color groups the TS module re-exports.
    expect(values).toContain('#d4b06a'); // p5/state/library
    expect(values).toContain('1px'); // border.minWidth
    expect(values).toContain('0.25rem'); // spacing.xs
    // Defensive filtering: numbers, null and nested objects never enter the
    // allowlist (otherwise Set{[object Object]} would pass every check).
    expect(
      canonicalValues({
        palette: {
          ok: '#00ff00',
          count: 3,
          missing: null,
          nested: { hex: '#111111' },
        },
        list: ['#0000ff', 7, {}, null],
      }),
    ).toEqual(['#00ff00', '#0000ff']);
  });
});
