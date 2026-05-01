---
agents_version: 7.0
scope: root
extends: null
last_updated: 2026-04-24
owner: github:@maintainers
---

# AGENTS.md

Nabatable global agent contract. Keep this file thin. Use `docs/sdlc/*` for delivery rules and `.agents/*` for role contracts.

## Non-negotiables

- Secrets never belong in source, logs, or task artifacts.
- Supabase is remote-only. Stage on staging first, then production.
- Do not claim verification that was not performed.
- UI changes require browser verification on a real shipped route. `/dev/**` and `__dev/**` harnesses are supplements only.
- Shadcn/ui-first is mandatory. Reuse existing primitives before creating new ones.
- Shadcn primitive layer is single-rooted at `components/ui/*`. No native HTML primitives or parallel UI systems are allowed in app code; `pnpm node scripts/check-no-shadcn.mjs --primitives-only` is the gate.
- Ops uses the default shadcn theme. Guest/public uses Radix Luma.
- Medium- and high-risk work requires `tasks/<slug>-YYYYMMDD-HHMM>/`.

## Repo truths

- Two shipped surfaces exist:
  - ops on the app host and `src/app/app/**`
  - guest/public on the root host via `src/app/(public)/**` and `src/app/guest/**`
- Host and routing split is enforced in `src/proxy.ts`.
- Shared UI spans both `components/**` and `src/components/**`.

## Operating layer

Read these in order when planning or executing work:

1. `docs/sdlc/README.md`
2. `docs/sdlc/native-execution-loop.md`
3. `docs/sdlc/risk-tier-workflow.md`
4. `docs/sdlc/task-harness.md`
5. `docs/sdlc/verification.md`
6. `docs/sdlc/subagents.md`
7. `.agents/*.md`

## Validation reality

Use repo commands that actually exist:

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm exec vitest ...`
- `pnpm exec playwright test ...`
- `pnpm exec prettier --check ...`

There is no package-level `pnpm test` script and no markdownlint script.
