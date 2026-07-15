import js from '@eslint/js';
import path from 'node:path';
import url from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import nextConfig from 'eslint-config-next';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import sonarjs from 'eslint-plugin-sonarjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

const [nextBaseConfig, , nextIgnoreConfig] = nextConfig;

export default [
  nextBaseConfig,
  nextIgnoreConfig,
  {
    ignores: [
      '**/.backup*/',
      '**/.backup-*/',
      '**/node_modules/',
      '**/.next/',
      '**/dist/',
      '**/*-dist/',
      '.reserve-dist/**',
      '**/build/',
      '*.config.js',
      '*.config.mjs',
      'tailwind.config.js',
      'postcss.config.js',
      'next.config.js',
      'next-sitemap.config.js',
      'tests/load/**/*.js',
      'scripts/**/*.cjs',
      'scripts/**/*.mjs',
    ],
  },
  ...compat.config({
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      project: [
        './tsconfig.eslint.json',
        './reserve/tsconfig.reserve.json',
        './reserve/.storybook/tsconfig.json',
      ],
      tsconfigRootDir: __dirname,
    },
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:import/typescript',
      'prettier',
    ],
    settings: {
      'import/resolver': {
        typescript: {
          project: [
            './tsconfig.eslint.json',
            './reserve/tsconfig.reserve.json',
            './reserve/.storybook/tsconfig.json',
          ],
        },
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/display-name': 'off',
      'jsx-a11y/no-autofocus': 'off',
    },
  }),
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    plugins: {
      import: importPlugin,
      sonarjs,
    },
    rules: {
      'import/order': [
        'error',
        {
          groups: [['builtin', 'external'], ['internal'], ['parent', 'sibling', 'index'], ['type']],
          alphabetize: { order: 'asc', caseInsensitive: true },
          'newlines-between': 'always',
        },
      ],
    },
  },
  {
    files: [
      'app/**/*.{ts,tsx}',
      'components/**/*.{ts,tsx}',
      'hooks/**/*.{ts,tsx}',
      'lib/**/*.{ts,tsx}',
      'reserve/**/*.{ts,tsx}',
      'server/**/*.{ts,tsx}',
      'src/**/*.{ts,tsx}',
    ],
    rules: {
      // Existing domain orchestration is complex; this baseline prevents
      // regressions while new/refactored Worker code uses the tighter limits below.
      complexity: ['error', { max: 150 }],
      'max-depth': ['error', 7],
      'sonarjs/cognitive-complexity': ['error', 190],
    },
  },
  {
    files: ['cloudflare/**/*.{ts,tsx}'],
    rules: {
      complexity: ['error', { max: 30 }],
      'max-depth': ['error', 5],
      'sonarjs/cognitive-complexity': ['error', 35],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
      ],
    },
  },
  {
    files: ['cloudflare/**/*.{ts,tsx}'],
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    files: ['src/app/app/**/*.{js,jsx,ts,tsx}', 'src/components/features/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@radix-ui/*'],
              message:
                'Ops app and feature code must compose shadcn components from @/components/ui/* instead of importing Radix primitives directly.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['server/**/*.{js,ts,jsx,tsx}', 'tests/server/**/*.{js,ts,jsx,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'parse',
          message:
            'Use Luxon DateTime.fromISO(..., { setZone: true }) or other timezone-safe parsing helpers.',
        },
      ],
    },
  },
  {
    files: ['server/**/*.{js,ts,jsx,tsx}', 'tests/server/**/*.{js,ts,jsx,tsx}'],
    ignores: ['server/capacity/tables.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "FunctionDeclaration[id.name='windowsOverlap']",
          message: "Use the shared windowsOverlap helper from '@/server/capacity/tables'.",
        },
        {
          selector: "VariableDeclarator[id.name='windowsOverlap']",
          message: "Use the shared windowsOverlap helper from '@/server/capacity/tables'.",
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.{js,ts}'],
    rules: {
      'import/order': 'off',
    },
  },
];
