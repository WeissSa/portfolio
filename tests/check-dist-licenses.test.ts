/**
 * Legal gate B3 regression: the shared Anton OFL is an EXPLICIT exception, not
 * a blanket pass for every woff2. A newly added font must ship its own sibling
 * license or fail the gate.
 */
import { describe, expect, it } from 'vitest';
import { checkFontLicenses } from '../scripts/check-dist-licenses.mjs';

const ANTON = 'assets/anton-latin-400-normal-Byf51wtH.woff2';
const SHARED_OFL = 'fonts/ANTON-OFL.txt';
const EXTRA = 'assets/newface-regular-AbCd1234.woff2';

describe('checkFontLicenses (B3)', () => {
  it('passes the current single Anton font with the shared OFL', () => {
    expect(checkFontLicenses([ANTON, SHARED_OFL])).toEqual([]);
  });

  it('fails when a second woff2 has NO companion license', () => {
    expect(checkFontLicenses([ANTON, SHARED_OFL, EXTRA])).toEqual([
      `${EXTRA}: no companion license`,
    ]);
  });

  it('passes the second font once it has its own sibling license', () => {
    expect(
      checkFontLicenses([
        ANTON,
        SHARED_OFL,
        EXTRA,
        'assets/newface-regular-AbCd1234-OFL.txt',
      ]),
    ).toEqual([]);
  });

  it('fails the Anton font itself when the shared OFL is absent', () => {
    expect(checkFontLicenses([ANTON])).toEqual([
      `${ANTON}: no companion license`,
    ]);
  });

  it('fails when dist has no woff2 at all', () => {
    expect(checkFontLicenses([SHARED_OFL])).toEqual([
      'no woff2 found in dist/',
    ]);
  });
});
