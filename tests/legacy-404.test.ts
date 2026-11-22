import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

/**
 * The GitHub Pages 404 page must stay self-contained (no external script),
 * so we execute its inline script with a fake `window.location` instead of
 * duplicating the mapping rule in the test.
 */
// Vitest runs with the repo root as cwd; jsdom rewrites import.meta.url to a
// non-file scheme, so a plain cwd-relative path is the reliable way here.
const HTML = readFileSync(resolve(process.cwd(), 'public/404.html'), 'utf8');

const INLINE_SCRIPT = /<script>([\s\S]*?)<\/script>/.exec(HTML)?.[1];

function redirectTarget(pathname: string): string {
  if (!INLINE_SCRIPT) throw new Error('404.html has no inline script');
  const calls: string[] = [];
  runInNewContext(INLINE_SCRIPT, {
    window: {
      location: {
        pathname,
        replace: (target: string) => calls.push(target),
      },
    },
  });
  expect(calls).toHaveLength(1);
  return calls[0]!;
}

describe('legacy 404 redirect (public/404.html)', () => {
  it('keeps the redirect inline and self-contained', () => {
    expect(HTML).not.toMatch(/<script[^>]+src=/i);
    expect(INLINE_SCRIPT).toBeTruthy();
  });

  it.each([
    ['/portfolio/climate-change', '/portfolio/#/climate'],
    ['/portfolio/climate-change.html', '/portfolio/#/climate'],
    ['/portfolio/climate-change/', '/portfolio/#/climate'],
    ['/portfolio/climate-change.html/', '/portfolio/#/climate'],
    ['/portfolio/CLIMATE-CHANGE.HTML', '/portfolio/#/climate'],
  ])('maps legacy climate path %s to %s', (path, expected) => {
    expect(redirectTarget(path)).toBe(expected);
  });

  it.each([
    '/portfolio/',
    '/portfolio/some/other/page',
    '/climate-change',
    '/',
  ])('maps unknown path %s to the portfolio root', (path) => {
    expect(redirectTarget(path)).toBe('/portfolio/');
  });
});
