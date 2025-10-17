import js from "@eslint/js";
import path from "node:path";
import url from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
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
    extends: [
      "plugin:@next/next/core-web-vitals",
      "eslint:recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:react-hooks/recommended",
      "plugin:jsx-a11y/recommended",
      "plugin:import/recommended",
      "plugin:import/typescript",
      "prettier",
    ],
    plugins: ["@typescript-eslint", "jsx-a11y", "import"],
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
];
