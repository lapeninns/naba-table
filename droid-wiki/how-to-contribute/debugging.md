# Debugging

For host or redirect bugs, start in `src/proxy.ts` and `next.config.js`. For API bugs, start in `src/app/api/**/route.ts` and follow into `server/**`. For env failures, run `pnpm validate:env` and inspect `config/env.schema.ts`, `lib/env.ts`, and `scripts/validate-env.ts`.

Related: [How to monitor](../how-to-monitor/index.md).
