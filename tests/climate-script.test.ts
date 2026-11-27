/**
 * Build-time snapshot guard (review backlog items 6 + 11). The script runs in
 * `prebuild`, so a source-level assertion is the headless equivalent of running
 * it against a hostile API response: it must use the shared timeout and must
 * never overwrite the bundled fallback with an all-null dataset.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const SCRIPT = read('../scripts/fetch-climate-snapshot.mjs').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

describe('fetch-climate-snapshot.mjs wiring', () => {
  it('uses the shared 15s deadline instead of an inline duplicate', () => {
    expect(SCRIPT).toMatch(/CLIMATE_FETCH_TIMEOUT_MS as FETCH_TIMEOUT_MS/);
    expect(SCRIPT).toMatch(/AbortSignal\.timeout\(FETCH_TIMEOUT_MS\)/);
    expect(SCRIPT).not.toMatch(/AbortSignal\.timeout\(15_000\)/);
  });

  it('guards against an all-null API payload before writing the snapshot', () => {
    expect(SCRIPT).toMatch(/MIN_SNAPSHOT_RECORDS\s*=\s*\d+/);
    expect(SCRIPT).toMatch(
      /typeof value === 'number' && Number\.isFinite\(value\)/,
    );
    const guard = SCRIPT.indexOf(
      'Object.keys(flat).length < MIN_SNAPSHOT_RECORDS',
    );
    const write = SCRIPT.indexOf('await writeFile(');
    expect(guard).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(write);
  });
});
