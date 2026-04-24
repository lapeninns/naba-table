---
agents_version: 6.0
scope: root
extends: null
last_updated: 2026-04-24
owner: github:@maintainers
---

# AGENTS.md

Nabatable — restaurant reservation SaaS. Next.js 16 (App Router) + Supabase + shadcn/ui + Vercel.
Two surfaces: **operator dashboard** (`src/app/app/**`) and **guest booking** (`src/app/(public)/**`, `src/app/guest/**`).

---

## Rules

- **Secrets never in source.** Use env vars / secret stores only.
- **Supabase is remote-only.** No local Supabase. Staging first, then production.
- **UI verification required.** Manual browser QA for any UI change.
- **Accessibility baseline.** Keyboard navigation, visible focus, semantic HTML, WCAG AA contrast.
- **Shadcn/ui first.** Use existing primitives before creating custom components.
- **Conventional Commits.** `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.

---

## Working Defaults

- Read relevant files before editing. Understand existing code first.
- Keep changes scoped and minimal. Don't refactor unrelated code.
- Prefer existing patterns (DRY/KISS/YAGNI). Don't over-engineer.
- Validate at system boundaries only. Trust internal invariants.
- Provide loading, empty, error, and success states for UI.
- Document assumptions and deviations in the task folder.
- Target ≤500 LOC per file (hard cap 750; imports/types excluded).

---

## Risk-Tier Workflow

| Risk       | Scope                                             | Process                                                                  |
| ---------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| **Low**    | Bug fix, copy change, small refactor              | Fix → test → PR. Task folder optional.                                   |
| **Medium** | New feature, component, API endpoint              | Task folder required. research.md + plan.md before coding.               |
| **High**   | DB migration, auth change, cross-cutting refactor | Full SDLC. Task folder + verification.md + artifacts. Maintainer review. |

Task folder structure: `tasks/<slug>-YYYYMMDD-HHMM>/`.

---

## Build & Test

```bash
pnpm install          # Install dependencies
pnpm run dev          # Dev server
pnpm run build        # Production build
pnpm run lint         # Lint
pnpm run typecheck    # TypeScript check
pnpm run test         # Tests (Vitest)
```

---

## Git

- Branch: `task/<slug>-YYYYMMDD-HHMM` or `hotfix/<slug>-YYYYMMDD-HHMM`
- Do not push without explicit user consent.
- Stage only files related to the current task — never `git add -A`.
- PR must reference task folder and include verification evidence.

---

## Security

- No secrets in code, logs, or artifacts. Env vars only.
- Validate/sanitize untrusted input at boundaries.
- Enforce auth/authz and tenant isolation.
- No delete/move/overwrite files without explicit user request.

---

## Key Design Systems

- **Ops (operator dashboard):** Default shadcn/ui theme.
- **Guest (public booking):** Radix Luma design system.
