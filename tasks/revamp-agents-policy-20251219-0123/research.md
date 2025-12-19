---
task: revamp-agents-policy
timestamp_utc: 2025-12-19T01:23:42Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: AGENTS Policy Revamp

## Requirements

- Functional:
  - Replace root `AGENTS.md` with a repository-specific policy (commands, structure, workflows).
  - Replace existing nested `AGENTS.md` files with repo-specific guidance.
  - Decide whether to add new nested `AGENTS.md` files for other major areas (e.g., `reserve/`, `server/`, legacy `components/` + `hooks/`).
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve security rules from repo docs (no secrets in source, env validation, secret scanning).
  - Keep Supabase **remote-only** posture (per README + docs).
  - Keep mandatory manual UI QA via Chrome DevTools MCP for UI changes.

## Existing Patterns & Reuse

- Root stack: Next.js 16 (App Router), React 19, TypeScript, Supabase remote-only. README + `docs/environments.md` define env guardrails.
- Secondary UI surface: `reserve/` Vite app + Storybook; scripts in `package.json` (`reserve:dev`, `reserve:build`, `storybook`).
- Backend/domain logic: `server/` (capacity, bookings, jobs, ops) with shared types and services.
- Next app structure in `src/`:
  - `src/app` (routes + API)
  - `src/components`, `src/hooks`, `src/services/ops`
- Legacy/parallel UI layers referenced via TS paths:
  - `components/` and `hooks/` are still in path aliases (`tsconfig.json`).
- Tooling & scripts (from `package.json`):
  - `pnpm dev`, `build`, `lint`, `typecheck`, `test`, `validate:env`, `secret:scan`, `db:*` scripts.
- Shadcn UI configured via `components.json` and used in `src/components/ui` and `reserve/shared/ui`.

## External Resources

- N/A (repo-specific policy).

## Constraints & Risks

- Root file must remain `/AGENTS.md` (exact casing).
- Nested files must include frontmatter with `scope: subproject` and a valid `extends:` path.
- Must avoid referencing tools/workflows that are not present in this repo.
- Ensure policy does not conflict with env guardrails (e.g., `validate:env`, staging vs prod rules).

## Open Questions (owner, due)

- Q: Who should be listed as owner/reviewers for root and subproject policies?
  A: TBD (maintainer confirmation).
- Q: Which subprojects should have nested `AGENTS.md`?
  A: Suggested set: `src/app`, `src/components`, `src/hooks`, `src/services/ops`, `reserve`, `server`, `components`, `hooks`.
- Q: Preferred level of process strictness?
  A: Keep SDLC task folders + artifacts, or simplify to a lighter workflow?

## Recommended Direction (with rationale)

- Provide a lean root policy tailored to this repo’s multi-surface architecture (Next app + Vite reserve + server domain).
- Keep/introduce nested policies for the most active areas so contributors know where to place logic and how to test.
- Preserve non-negotiables (no secrets, remote-only Supabase, manual UI QA) and align commands with `package.json`/docs.
