/**
 * Named-bucket budget gate (art-overhaul commit 0). The check must keep
 * gating `Room-*.js` even when unrelated lazy chunks land, and must NOT let an
 * unbucketed chunk rename silently disable the gate.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// npm always runs vitest from the package root; an absolute path keeps the
// fixture's different cwd from affecting which script is executed.
const SCRIPT = resolve(process.cwd(), 'scripts/check-3d-budget.mjs');

const fixtures: string[] = [];

/** Minimal standalone package dir: size-limit requires a package.json in cwd. */
function fixture(files: Record<string, Buffer | string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'portfolio-budget-'));
  fixtures.push(dir);
  mkdirSync(join(dir, 'dist', 'assets'), { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'budget-fixture',
      version: '0.0.0',
      private: true,
      // Same file preset the real repo uses; without it size-limit cannot
      // decide how to measure and every fixture would fail for the wrong reason.
      'size-limit': [{ path: 'dist/assets/*.js', limit: '300 KB' }],
      devDependencies: { '@size-limit/file': '^11.2.0' },
    }),
  );
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, 'dist', 'assets', name), content);
  }
  // size-limit resolves its file preset from the project root; point the
  // fixture at the real installed tree instead of installing anything.
  symlinkSync(
    resolve(process.cwd(), 'node_modules'),
    join(dir, 'node_modules'),
  );
  return dir;
}

function run(dir: string) {
  return spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: 'utf8' });
}

afterEach(() => {
  for (const dir of fixtures.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('check-3d-budget.mjs chunk buckets', () => {
  it('puts Room-*.js in the 3D bucket and ignores the shell chunk', () => {
    const result = fixture({
      'Room-scene.js': 'console.log("scene")',
      'index-shell.js': 'console.log("shell")',
    });
    const { status, stdout, stderr } = run(result);
    expect(status, stderr).toBe(0);
    expect(stdout).toContain('3d-scene chunk(s): Room-scene.js');
    expect(stdout).not.toContain('index-shell.js');
  });

  it('fails when the Room-*.js scene chunk exceeds its brotli limit', () => {
    const result = fixture({
      // Incompressible bytes: brotli cannot squeeze 290 KB under 260 KB.
      'Room-too-big.js': randomBytes(290_000),
    });
    const { status, stderr, stdout } = run(result);
    expect(status).not.toBe(0);
    expect(stdout).toContain('3d-scene chunk(s): Room-too-big.js');
    expect(stderr).toContain('3d-scene chunk budget EXCEEDED');
    // Limit text is derived from the bucket config, not a duplicated literal.
    expect(stderr).toContain('260 KB');
  });

  it('fails loudly on an unbucketed non-shell chunk instead of silently passing', () => {
    const result = fixture({
      'index-shell.js': 'console.log("shell")',
      'ui-later.js': 'console.log("future lazy UI")',
    });
    const { status, stderr } = run(result);
    expect(status).not.toBe(0);
    expect(stderr).toContain('unbucketed lazy chunk(s): ui-later.js');
    expect(stderr).toContain('Add a named bucket');
  });

  it('passes with an informational message when no lazy scene chunk exists yet', () => {
    const { status, stdout } = run(fixture({ 'index-shell.js': 'shell' }));
    expect(status).toBe(0);
    expect(stdout).toContain('no matching chunk emitted yet — deferred');
  });
});
