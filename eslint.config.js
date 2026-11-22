import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginTypeScript from '@typescript-eslint/eslint-plugin';
import parserTypeScript from '@typescript-eslint/parser';
import pluginPrettier from 'eslint-plugin-prettier';
import configPrettier from 'eslint-config-prettier';

export default [
  {
    // Legacy Next.js/Vue-era sources stay unreferenced until the cleanup
    // commit (see REWORK_PLAN ladder #11); they are outside the new
    // typecheck/lint/build scope on purpose.
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
    },
    settings: {
      react: {
        version: 'detect',
      },
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
];
