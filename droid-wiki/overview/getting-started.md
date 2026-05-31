# Getting started

Use Node `>=20.11.1` and pnpm `>=10.12.1` as declared in `package.json`.

```bash
pnpm install
cp .env.example .env.local
pnpm validate:env
pnpm dev
```

`pnpm dev` runs environment validation before starting Next. Supabase is remote-only, so real credentials belong in ignored env files or hosted secret managers, and local or preview work should use staging values unless production work is explicitly requested.

## Common commands

| Command                          | Purpose                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm run lint`                  | ESLint for configured server/lib/scripts/app feature scopes plus strict shadcn primitive guard. |
| `pnpm run typecheck`             | TypeScript project check.                                                                       |
| `pnpm exec vitest ...`           | Targeted unit, component, server, QA, and reserve tests.                                        |
| `pnpm exec playwright test ...`  | Browser tests, usually with root-host or app-host configs.                                      |
| `pnpm exec prettier --check ...` | Formatting check for docs and touched files.                                                    |
| `pnpm validate:env`              | Environment and production-resource safety check.                                               |

There is no package-level `pnpm test` script and no markdownlint script.
