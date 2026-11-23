/**
 * Fixtures for the CSS-side color guard (the ESLint rule cannot parse .css).
 * Valid: token vars in rules and canonical hex in :root. Invalid: raw hex in
 * a normal rule, or a non-canonical hex introduced inside :root.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  findNonTokenRootHex,
  findRawHexOutsideRoot,
  stripCssComments,
} from '../scripts/css-hex-guard.mjs';
import { ALL_TOKEN_VALUES } from '../src/styles/design-tokens';

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
    // Derive the allowlist from the canonical tokens: the commit-2 recolor
    // changes every P5 :root hex, so a pinned fixture would go stale silently.
    const allowed = ALL_TOKEN_VALUES;
    for (const file of ['p5.css', 'index.css', 'static-mirror.css']) {
      const css = read(`../src/styles/${file}`);
      expect(findRawHexOutsideRoot(css), file).toEqual([]);
      expect(findNonTokenRootHex(css, allowed), file).toEqual([]);
    }
  });
});
