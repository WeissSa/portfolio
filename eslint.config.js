import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginTypeScript from '@typescript-eslint/eslint-plugin';
import parserTypeScript from '@typescript-eslint/parser';
import pluginPrettier from 'eslint-plugin-prettier';
import configPrettier from 'eslint-config-prettier';
import { noRawHex } from './scripts/eslint-no-raw-hex.mjs';
import { oneComponentPerFile } from './scripts/eslint-one-component-per-file.mjs';
import { noUnsafeCast } from './scripts/eslint-no-unsafe-cast.mjs';

export default [
  {
    // Legacy Next.js/Vue-era sources were removed in the final cleanup pass;
    // the old paths stay ignored defensively so a stray re-add cannot silently
    // enter lint scope. Active sources live under src/, tests/ and scripts/.
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'pages/**',
      'components/**',
      'lib/**',
      'contexts/**',
      'constants/**',
      'data/**',
      'styles/**',
      'tests/unit/**',
      'public/**',
      '~/**',
      'next.config.mjs',
      'next-env.d.ts',
      'jest.setup.js',
      '404.html',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      parser: parserTypeScript,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 12,
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
      '@typescript-eslint': pluginTypeScript,
      prettier: pluginPrettier,
      local: {
        rules: {
          'no-raw-hex': noRawHex,
          'one-component-per-file': oneComponentPerFile,
          'no-unsafe-cast': noUnsafeCast,
        },
      },
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...pluginReact.configs.recommended.rules,
      ...pluginTypeScript.configs.recommended.rules,
      ...configPrettier.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '_',
          varsIgnorePattern: '_',
          caughtErrorsIgnorePattern: '_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'error',
      // Palette drift guard: all colors must flow through design tokens.
      'local/no-raw-hex': 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    // Owner FE principles (2026-11-27), enforced where product components and
    // typed source live. Tests/specs are fixtures and are exempt by the rules
    // themselves. Existing multi-component modules listed below are the only
    // grandfathered exceptions; every NEW component added to them is still
    // reported by the rule's per-declaration check.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'local/one-component-per-file': 'error',
      'local/no-unsafe-cast': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    languageOptions: {
      globals: {
        describe: true,
        it: true,
        test: true,
        expect: true,
        vi: true,
        beforeAll: true,
        beforeEach: true,
        afterAll: true,
        afterEach: true,
      },
    },
  },
  {
    // react-three-fiber elements (<mesh>, <group>, <pointLight>, …) take
    // three.js props (position, geometry, material, args, attach, intensity,
    // …) that eslint-plugin-react's DOM-oriented no-unknown-property rule
    // does not recognise. R3F's own types already validate these props, so the
    // rule only produces false positives inside the scene tree.
    files: ['src/scene/**/*.{ts,tsx}'],
    rules: {
      'react/no-unknown-property': 'off',
    },
  },
];
