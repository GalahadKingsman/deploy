import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
      {
        ignores: [
          '**/dist/**',
          '**/build/**',
          '**/.turbo/**',
          '**/node_modules/**',
          '**/*.cjs',
          '**/*.config.cjs',
          'tools/verify/**',
          'tools/tests/**', // Exclude test files from linting (Node.js built-in test)
        ],
      },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Base TS rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // React rules (only for webapp)
  {
    files: ['apps/webapp/**/*.{ts,tsx}'],
    plugins: { react: reactPlugin, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
    },
  },

  // Node scripts (tools/dev) — allow console/process
  {
    files: ['tools/dev/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },

  // Node scripts (tools/scripts) — allow console/process etc.
  {
    files: ['tools/scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },

  // Prettier compatibility
  eslintConfigPrettier,
];
