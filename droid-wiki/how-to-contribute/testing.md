# Testing

Use repo commands that actually exist and match the changed files.

| Command                          | Use when                                                                |
| -------------------------------- | ----------------------------------------------------------------------- |
| `pnpm run lint`                  | Server/lib/scripts plus configured app feature scopes and shadcn guard. |
| `pnpm run typecheck`             | TypeScript project validation.                                          |
| `pnpm exec vitest ...`           | Targeted server, component, reserve, security, and utility tests.       |
| `pnpm exec playwright test ...`  | Browser tests on real root-host or app-host routes.                     |
| `pnpm exec prettier --check ...` | Markdown/docs and formatting-sensitive touched files.                   |
| `pnpm validate:env`              | Environment-backed runtime, Supabase, or deployment safety checks.      |

`pnpm test` runs the Vitest suite. There is no markdownlint script. `pnpm run lint` does not cover every JS/TS path, so use targeted ESLint for changed JS/TS outside its configured scope.

Related: [Tooling](tooling.md).
