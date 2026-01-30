import js from "@eslint/js";
import path from "node:path";
import url from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import nextConfig from "eslint-config-next";
import importPlugin from "eslint-plugin-import";
import reactHooks from "eslint-plugin-react-hooks";

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
      "**/.backup*/",
      "**/.backup-*/",
      "**/node_modules/",
      "**/.next/",
      "**/dist/",
      "**/*-dist/",
      ".reserve-dist/**",
      "**/build/",
      "*.config.js",
      "*.config.mjs",
      "test-email.mjs",
      "tailwind.config.js",
      "postcss.config.js",
      "next.config.js",
      "next-sitemap.config.js",
      "tests/load/**/*.js",
      "scripts/**/*.cjs",
      "scripts/**/*.mjs",
    ],
  },
  ...compat.config({
    root: true,
    parser: "@typescript-eslint/parser",
    parserOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      project: [
        "./tsconfig.eslint.json",
        "./reserve/tsconfig.reserve.json",
        "./reserve/.storybook/tsconfig.json",
      ],
      tsconfigRootDir: __dirname,
    },
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "plugin:import/typescript", "prettier"],
    settings: {
      "import/resolver": {
       typescript: {
          project: [
            "./tsconfig.eslint.json",
            "./reserve/tsconfig.reserve.json",
            "./reserve/.storybook/tsconfig.json",
          ],
       },
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "react/display-name": "off",
      "jsx-a11y/no-autofocus": "off",
      // Cyclomatic complexity - warn at 15, error at 25
      "complexity": ["warn", { max: 15 }],
      // Max lines per function
      "max-lines-per-function": ["warn", { max: 100, skipBlankLines: true, skipComments: true }],
      // Max depth of nested blocks
      "max-depth": ["warn", { max: 4 }],
    },
  }),
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      "import/order": [
        "error",
        {
          groups: [["builtin", "external"], ["internal"], ["parent", "sibling", "index"], ["type"]],
          alphabetize: { order: "asc", caseInsensitive: true },
          "newlines-between": "always",
        },
      ],
    },
  },
  {
    files: ["server/**/*.{js,ts,jsx,tsx}", "tests/server/**/*.{js,ts,jsx,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "Date",
          property: "parse",
          message: "Use Luxon DateTime.fromISO(..., { setZone: true }) or other timezone-safe parsing helpers.",
        },
      ],
    },
  },
  {
    files: ["server/**/*.{js,ts,jsx,tsx}", "tests/server/**/*.{js,ts,jsx,tsx}"],
    ignores: ["server/capacity/tables.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
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
    files: ["scripts/**/*.{js,ts}"],
    rules: {
      "import/order": "off",
    },
  },
  // Module boundary enforcement - prevent cross-layer imports
  {
    files: ["src/**/*.{js,ts,jsx,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../../server/*", "../../../../server/*"],
              message: "Use @/server/* alias for server imports from src/",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["reserve/**/*.{js,ts,jsx,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/server/**"],
              message: "Reserve package should not import from server/ directly. Use API calls.",
            },
            {
              group: ["**/src/app/**"],
              message: "Reserve package should not import from src/app/. Use shared modules.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["server/**/*.{js,ts,jsx,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "@/components/*", "@/hooks/*"],
              message: "Server modules should not import React components or hooks.",
            },
          ],
        },
      ],
    },
  },
];
