import js from "@eslint/js";
import path from "node:path";
import url from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import nextConfig from "eslint-config-next";

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
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "warn",
      "import/order": [
        "error",
        {
          groups: [["builtin", "external"], ["internal"], ["parent", "sibling", "index"], ["type"]],
          alphabetize: { order: "asc", caseInsensitive: true },
          "newlines-between": "always",
        },
      ],
      "jsx-a11y/no-autofocus": "off",
    },
  }),
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
];
