# Getting started

Use Node `>=20.11.1` and pnpm `>=10.12.1` as declared in `package.json`.

```bash
pnpm install
cp .env.example .env.local
pnpm validate:env
pnpm dev
```

`pnpm dev` runs environment validation before starting Next. Supabase is remote-only, so keep real credentials in ignored env files or secret managers, and use staging values unless production work is explicitly requested.

## Common commands

| Command                                   | Purpose                                    |
| ----------------------------------------- | ------------------------------------------ |
| `pnpm run lint`                           | ESLint plus strict shadcn primitive guard. |
| `pnpm run typecheck`                      | TypeScript project check.                  |
| `pnpm exec vitest ...`                    | Unit/component tests.                      |
| `pnpm exec playwright test ...`           | Browser tests.                             |
| `pnpm exec prettier --check ...`          | Formatting check.                          |
| `pnpm reserve:dev` / `pnpm reserve:build` | Reserve app dev/build.                     |

See [Testing](../how-to-contribute/testing.md) and [Configuration](../reference/configuration.md).
