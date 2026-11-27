/**
 * Fixtures for the no-unsafe-cast lint rule: type-erasing casts are reported,
 * ordinary typed assertions and test fixtures are allowed.
 */
import { RuleTester } from 'eslint';
import parserTypeScript from '@typescript-eslint/parser';
import { describe, it } from 'vitest';
import { noUnsafeCast } from '../scripts/eslint-no-unsafe-cast.mjs';

RuleTester.describe = describe;
RuleTester.it = it;

describe('local/no-unsafe-cast lint rule', () => {
  const tester = new RuleTester({
    languageOptions: {
      parser: parserTypeScript,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
  });

  tester.run('no-unsafe-cast', noUnsafeCast, {
    valid: [
      {
        filename: 'src/ui/Widget.ts',
        code: 'const button = event.currentTarget as HTMLButtonElement;',
      },
      {
        filename: 'src/ui/Widget.ts',
        code: 'const config = { level: 2 } as const;',
      },
      {
        filename: 'src/ui/Widget.ts',
        code: 'const value: number = current;',
      },
      {
        filename: 'tests/widget.test.ts',
        code: 'const fn = handler as unknown as typeof window.matchMedia;',
      },
    ],
    invalid: [
      {
        filename: 'src/ui/Widget.ts',
        code: 'const value = current as unknown;',
        errors: [{ messageId: 'unsafeCast' }],
      },
      {
        filename: 'src/ui/Widget.ts',
        code: 'const value = current as unknown as Record<string, string>;',
        errors: [{ messageId: 'unsafeCast' }],
      },
      {
        filename: 'src/ui/Widget.ts',
        code: 'const value = current as any;',
        errors: [{ messageId: 'unsafeCast' }],
      },
      {
        filename: 'src/ui/Widget.ts',
        code: 'const value = current as never;',
        errors: [{ messageId: 'unsafeCast' }],
      },
      {
        filename: 'src/ui/Widget.ts',
        code: 'const value = <unknown>current;',
        errors: [{ messageId: 'unsafeCast' }],
      },
    ],
  });
});
