/**
 * Fixtures for the one-component-per-file lint rule. Verifies that a single
 * component plus hooks/helpers is valid, while a second JSX-rendering
 * declaration in the same file is reported (and that fixtures are exempt).
 */
import { RuleTester } from 'eslint';
import parserTypeScript from '@typescript-eslint/parser';
import { describe, it } from 'vitest';
import { oneComponentPerFile } from '../scripts/eslint-one-component-per-file.mjs';

RuleTester.describe = describe;
RuleTester.it = it;

describe('local/one-component-per-file lint rule', () => {
  const tester = new RuleTester({
    languageOptions: {
      parser: parserTypeScript,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
  });

  tester.run('one-component-per-file', oneComponentPerFile, {
    valid: [
      {
        filename: 'src/ui/Widget.tsx',
        code: `
          function useWidget() { return 1; }
          export function Widget() { const n = useWidget(); return <div>{n}</div>; }
        `,
      },
      {
        // Uppercase data constant without JSX is not a component.
        filename: 'src/ui/Widget.tsx',
        code: `
          const DEFAULTS = { label: 'x' };
          export const Widget = () => <div>{DEFAULTS.label}</div>;
        `,
      },
      {
        filename: 'tests/widget.test.tsx',
        code: 'export const A = () => <div />; export const B = () => <span />;',
      },
      {
        filename: 'src/lib/pure.ts',
        code: 'export function normalize(x: number) { return x + 1; }',
      },
    ],
    invalid: [
      {
        filename: 'src/ui/Widget.tsx',
        code: `
          export const Widget = () => <div />;
          export const Secondary = () => <span />;
        `,
        errors: [{ messageId: 'multipleComponents' }],
      },
      {
        filename: 'src/ui/Widget.tsx',
        code: `
          export function Widget() { return <div />; }
          function HelperPanel() { return <section />; }
        `,
        errors: [{ messageId: 'multipleComponents' }],
      },
    ],
  });
});
