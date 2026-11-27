/**
 * Fixtures for the one-component-per-file lint rule. Verifies that a single
 * component plus hooks/helpers is valid, while a second JSX-rendering
 * declaration in the same file is reported (and that fixtures are exempt).
 *
 * Covers every component shape the rule recognises: named functions, arrows,
 * memo/forwardRef wrappers, anonymous default exports, classes with a JSX
 * render(), class expressions and conditional-expression initializers. Also
 * checks that grandfathered names are exempt ONLY at their listed paths.
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
      {
        // A single memo-wrapped component (the SceneLayer.tsx shape) is fine.
        filename: 'src/ui/SceneLayer.tsx',
        code: `
          import { memo } from 'react';
          import { SceneLayerImpl } from './SceneLayerImpl';
          export const SceneLayer = memo(SceneLayerImpl);
        `,
      },
      {
        // Non-component classes and non-JSX render() are not components.
        filename: 'src/ui/SceneErrorBoundary.tsx',
        code: `
          import { Component } from 'react';
          export class SceneErrorBoundary extends Component {
            render() { return null; }
          }
        `,
      },
      {
        // Grandfathered names are exempt at their listed path (and the first
        // component is always free anyway).
        filename: 'src/ui/primitives.tsx',
        code: `
          export function P5Panel() { return <div />; }
          export function DisplayTitle() { return <h2 />; }
          export function TagChip() { return <li />; }
        `,
      },
      {
        // Other grandfathered names stay exempt in their own files too.
        filename: 'src/scene/Room.tsx',
        code: `
          export function Room() { return <div />; }
          export function Books() { return <span />; }
        `,
      },
    ],
    invalid: [
      {
        filename: 'src/ui/Widget.tsx',
        code: `
          export const Widget = () => <div />;
          export const Secondary = () => <span />;
        `,
        errors: [
          { messageId: 'multipleComponents', data: { name: 'Secondary' } },
        ],
      },
      {
        filename: 'src/ui/Widget.tsx',
        code: `
          export function Widget() { return <div />; }
          function HelperPanel() { return <section />; }
        `,
        errors: [
          { messageId: 'multipleComponents', data: { name: 'HelperPanel' } },
        ],
      },
      {
        // Two extra components are both reported, with their names in order.
        filename: 'src/ui/Widget.tsx',
        code: `
          export const A = () => <div />;
          export const B = () => <span />;
          export const C = () => <b />;
        `,
        errors: [
          { messageId: 'multipleComponents', data: { name: 'B' } },
          { messageId: 'multipleComponents', data: { name: 'C' } },
        ],
      },
      {
        // memo(...) wrappers count as components.
        filename: 'src/ui/Widget.tsx',
        code: `
          import { memo } from 'react';
          export const Widget = memo(() => <div />);
          export const Aux = memo(() => <span />);
        `,
        errors: [{ messageId: 'multipleComponents', data: { name: 'Aux' } }],
      },
      {
        // forwardRef(...) and a memo wrapper around an imported identifier.
        filename: 'src/ui/Widget.tsx',
        code: `
          import { memo, forwardRef } from 'react';
          export const Widget = memo(ImportedImpl);
          export const Other = forwardRef((props, ref) => <span ref={ref} />);
        `,
        errors: [{ messageId: 'multipleComponents', data: { name: 'Other' } }],
      },
      {
        // Anonymous default-export arrow function.
        filename: 'src/ui/Widget.tsx',
        code: `
          export const Widget = () => <div />;
          export default () => <span />;
        `,
        errors: [
          { messageId: 'multipleComponents', data: { name: 'Default' } },
        ],
      },
      {
        // Anonymous default-export function declaration.
        filename: 'src/ui/Widget.tsx',
        code: `
          export const Widget = () => <div />;
          export default function () { return <span />; }
        `,
        errors: [
          { messageId: 'multipleComponents', data: { name: 'Default' } },
        ],
      },
      {
        // Class component with a JSX render() method.
        filename: 'src/ui/Widget.tsx',
        code: `
          export const Widget = () => <div />;
          export class Panel extends React.Component {
            render() { return <span />; }
          }
        `,
        errors: [{ messageId: 'multipleComponents', data: { name: 'Panel' } }],
      },
      {
        // Class expression with a JSX render() method.
        filename: 'src/ui/Widget.tsx',
        code: `
          export const Widget = () => <div />;
          export const Panel = class extends React.Component {
            render() { return <span />; }
          };
        `,
        errors: [{ messageId: 'multipleComponents', data: { name: 'Panel' } }],
      },
      {
        // Conditional-expression initializer with two JSX branches.
        filename: 'src/ui/Widget.tsx',
        code: `
          export const Widget = () => <div />;
          export const Chameleon = flag ? () => <span /> : () => <b />;
        `,
        errors: [
          { messageId: 'multipleComponents', data: { name: 'Chameleon' } },
        ],
      },
      {
        // Grandfathered names are exempt only at their listed path.
        filename: 'src/ui/widgets.tsx',
        code: `
          export function P5Panel() { return <div />; }
          export function DisplayTitle() { return <h2 />; }
        `,
        errors: [
          { messageId: 'multipleComponents', data: { name: 'DisplayTitle' } },
        ],
      },
      {
        // Adding a NEW component to a grandfathered file is still an error.
        filename: 'src/scene/Room.tsx',
        code: `
          export function Room() { return <div />; }
          export function Books() { return <span />; }
          export function FreshPanel() { return <b />; }
        `,
        errors: [
          { messageId: 'multipleComponents', data: { name: 'FreshPanel' } },
        ],
      },
    ],
  });
});
