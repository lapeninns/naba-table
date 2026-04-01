---
agents_version: 5.4
scope: root
extends: null
last_updated: 2026-03-31
owner: github:@maintainers
---

# AGENTS.md

**SDLC‑aligned operating handbook for AI coding agents and human contributors (with MCP tooling)**

> Deliver reliable software changes using the same structure every time—mapped to a clear SDLC and enforced by policy‑as‑code.

---

## 0) Scope & Audience

- **Who**: AI coding agents, human engineers, reviewers, maintainers, release managers.
- **What**: The authoritative SDLC, workflow, quality bars, file structure, conventions, and MCP tool usage for any change (feature, fix, refactor, experiment).
- **Why**: Consistency, traceability, safe iteration—especially in monorepos and multi‑app repos.

For checklists, see **§11 Quick Reference**.

**Skills Directory**: See `.codex/skills/` (repo, if present) and `~/.codex/skills/` (global) for detailed capability specifications referenced throughout this document. In this repo, prefer the local foundation skills first: `nabatable-task-harness`, `nabatable-ui-proof`, and `nabatable-fullstack-delivery`.

---

## 1) Non‑Negotiables (Read First)

1. **Follow SDLC phases in order.** No coding before requirements & plan are reviewed.
2. **Everything is a Task** with its own UTC‑timestamped directory and artifacts.
3. **Manual UI QA via Chrome DevTools (MCP) is mandatory** for any UI change.
4. **Supabase: remote only.** Never run migrations or seeds against a local instance.
5. **Prefer existing patterns** (DRY/KISS/YAGNI). **Use SHADCN UI primitives** (via **Shadcn MCP**) for all UI; do not create custom primitives or base components.
6. **Accessibility is required** (WCAG/WAI‑ARIA APG). No exceptions.
7. **Document assumptions & deviations** in the task folder.
8. **Secrets never in source.** Use env vars/secret stores; never commit tokens.
9. **Conventional Commits** and **PR templates** are enforced.
10. **PRs must reference a valid task folder** (`tasks/<slug>-YYYYMMDD-HHMM>`). CI blocks merges otherwise.
11. **Root policy path is exact.** The root file **must be** `/AGENTS.md` (uppercase). Any other path/casing fails CI.
12. **Ship production-grade, scalable (>1000 users) implementations.** Avoid MVP/minimal shortcuts.
13. **Optimize for long-term sustainability.** Prefer maintainable, reliable designs.
14. **Make changes canonical in the primary codepath.** Avoid leaving duplicate/legacy paths; remove dead paths when part of the requested change (see §1D safety guards before deleting/moving files).
15. **Use direct, first-class integrations.** Do not introduce shims, wrappers, glue code, or adapter layers unless explicitly justified in `plan.md`.
16. **Single source of truth for business rules/policy.** Centralize validation, enums, flags, constants, and config.
17. **Clean API invariants.** Define required inputs, validate up front at boundaries, and fail fast with stable errors.
18. **Use latest stable libs/docs.** If unsure, do a web search and prefer primary/official docs (prefer 2026+ sources unless an older version is required).

### 1A) Non‑Overridable Core Rules (Root‑enforced; closest cannot relax)

Nested `AGENTS.md` files **cannot relax or override** these:

- Secrets never in source; only via env/secret store.
- Supabase is **remote‑only**; migrations require backup/rollback plan and evidence.
- Accessibility baseline (keyboard navigation; WCAG/WAI‑ARIA compliance).
- Manual UI QA via Chrome DevTools MCP for UI changes (with artifacts).
- Shadcn UI primitives are mandatory for all UI; custom primitives are not allowed without maintainer approval and plan.md justification.
- Conventional Commits; PR must include task artifacts and verification evidence.

> Anything listed here wins even against "closest‑wins" precedence.

### 1B) Simplicity & Scope Rules

> **Ref**: See **Style Principles** (~/.codex/skills/style-principles/SKILL.md) for detailed guidance.

- **Avoid over‑engineering.** Only make changes directly requested or clearly necessary.
- **Don't add features or configurability** beyond the ask. A bug fix doesn't require refactoring the whole module.
- **Validate only at system boundaries** (user input, external APIs). Trust internal invariants and framework guarantees.
- **Don't build abstractions for one‑off operations.** Reuse existing helpers; don't design for hypothetical future requirements.
- **Don't add backwards‑compat shims** if you can safely change the only caller.
- **Keep edits focused.** Don't "clean up" unrelated code in the same change.
- **Always read relevant files before editing.** Do not speculate about code you haven't inspected; follow existing patterns and style.
- **File size discipline**: Target <=500 LOC per file (hard cap 750; imports/types excluded). Split responsibilities when approaching the cap.
- **UI nesting discipline**: Keep UI/markup nesting <=3 levels; extract components/helpers when repetition or conditional complexity grows.

### 1C) Agent Quickstart

For **any change** (feature, fix, refactor):

1. **Find AGENTS policy**: From the file you're touching, walk up directories and collect all `AGENTS.md` (root → closest).
2. **Create a task folder**: `tasks/<slug>-YYYYMMDD-HHMM/` (UTC).
3. **Phase 1 — Requirements**: Fill `research.md` until **Definition of Ready** is met (§4, Phase 1).
4. **Phase 2 — Plan**: Fill `plan.md` with architecture, contracts, tests, rollout (§4, Phase 2).
5. **Phase 3 — Implement**: Use `todo.md` as a live checklist; keep notes and deviations up to date.
6. **Phase 4 — Verify**:
   - Run tests (unit/integration/E2E/a11y).
   - Run **Chrome DevTools MCP** (required for UI) and record perf/a11y.
   - Capture artifacts into `artifacts/` and summarize in `verification.md`.
7. **Phase 5+ — PR & Release**:
   - Open PR with **Conventional Commit** title, link task folder, and attach evidence.
   - Once merged, follow rollout plan and document outcomes in the task folder.

### 1D) Security & Safety Guards

- No delete/move/overwrite files without explicit user request; for deletions prefer `trash` over `rm`.
- Don’t expose secrets in code/logs; use env vars/secret stores.
- Validate/sanitize untrusted input to prevent injection, path traversal, SSRF, and unsafe uploads.
- Enforce AuthN/AuthZ and tenant boundaries; least privilege.
- Be cautious with new dependencies; flag supply-chain/CVE risk.

---

## 1.5) AGENTS.md Initialization & Discovery

### Before Starting Any Task

If no `AGENTS.md` exists in the working context:

1. **Walk up the directory tree** from the current path to the repo root.
2. **Check for `AGENTS.md`** at each level (**exact casing**).
3. **If none found**, create one using the initialization workflow below.

### Initialization Workflow

**Step 1: Determine Scope**

- **Root-level**: Creating `/AGENTS.md` → use full template (this file).
- **Subproject**: Creating `/apps/web/AGENTS.md` → use nested template (§7).

**Step 2: Scaffold the File**

- Add machine‑readable **frontmatter** to every `AGENTS.md`.

**Root AGENTS.md (minimal viable template)**

```markdown
---
agents_version: 5.4
scope: root
extends: null
last_updated: 2025-12-22
owner: github:@maintainers
---

# AGENTS.md

## Project Overview

<Brief description>

## Build & Test Commands

- `pnpm install` — Install
- `pnpm run dev` — Dev server
- `pnpm run build` — Production build
- `pnpm run test` — Tests
- `pnpm run lint` — Lint

## Code Style Guidelines

- <Conventions, naming, file org>

## Testing Instructions

- <How/where/coverage>

## Security Considerations

- Never commit secrets; use .env / secret store
- <Auth patterns / data handling>

## Additional Context

- Conventional Commits; PR template; Deployment notes
```

**Step 3: Commit It**

```bash
git add AGENTS.md
git commit -m "docs: initialize AGENTS.md for coding agents"
```

### Discovery Rules (for Agents & Tools)

- From path `X`, **walk up** to root collecting `AGENTS.md` (exact casing).
- Apply rules in order: **root → intermediate → closest** (**closest wins** on conflicts), except **Non‑Overridable Core Rules** which always win.
- On Unix (case‑sensitive) and macOS/Windows (default case‑insensitive), only `AGENTS.md` (uppercase) is valid. Files like `agents.md` **fail CI**.
- If none found at root: **Stop and create one** at root before proceeding (use minimal template above).

**Example**

```
/repo/AGENTS.md                          # Root rules (always apply)
/repo/apps/web/AGENTS.md                 # Web app rules (inherit + override)
/repo/apps/web/src/components/AGENTS.md  # Component-specific (closest precedence)
```

### Large Monorepos (many AGENTS.md files)

- Each package/app gets its own `AGENTS.md` focused on **local concerns**.
- Root covers **cross‑cutting** rules (CI/CD, security, commit standards).
- Nested files **must** include frontmatter with `scope: subproject`, `extends: ../../AGENTS.md`, and `agents_version`.

---

## 2) Task Structure & Naming

- **Directory**: `tasks/<slug>-YYYYMMDD-HHMM/` (UTC).
  - Slugs: `user-auth-flow`, `payment-gateway-integration`, `fix-avatar-cropping`.
  - Timestamp: `YYYYMMDD-HHMM` (e.g., `20250110-1430` → 2025‑01‑10 14:30 UTC).

**Required contents**

```
tasks/<slug>-YYYYMMDD-HHMM/
├── research.md       # Requirements & analysis (what exists, reuse, constraints)
├── plan.md           # Design/plan: objective, architecture, API, states, tests, rollout
├── todo.md           # Live implementation checklist (atomic steps)
├── verification.md   # Verification: manual QA, tests, perf/a11y budgets, sign-offs
└── artifacts/        # Evidence: Lighthouse JSON, HAR, traces, screenshots, db diffs
```

**Frontmatter (add to each task file)**

```markdown
---
task: <slug>
timestamp_utc: <ISO-8601 Z>
owner: github:@<handle>
reviewers: [github:@<handle>]
risk: low|medium|high
flags: [<feature_flag_keys>]
related_tickets: [<TICKET-123>]
---
```

---

## 3) SDLC at a Glance (Map → Artifacts → MCP → Skills)

| SDLC Phase                       | What happens                                       | Primary Artifacts             | Required MCP(s)                                                    | Skills Applied                                                                                    |
| -------------------------------- | -------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **0. Initiation**                | Create task, define scope stub                     | Task folder, stubs            | —                                                                  | **Continuity Ledger**                                                                             |
| **1. Requirements & Analysis**   | Inventory code, clarify requirements, risks        | `research.md`                 | **Codebase Retrieval**, **Context7**, **DeepWiki (if configured)** | **Continuity Ledger**, **MCP Integration**, **Multi-Agent Collaboration**                         |
| **2. Design & Planning**         | Architecture, contracts, UX states, tests, rollout | `plan.md`                     | **Shadcn**, **Supabase**                                           | **Frontend Aesthetics**, **Style Principles**, **MCP Integration**, **Multi-Agent Collaboration** |
| **3. Implementation**            | Code, migrations, components, unit tests           | `todo.md` (live)              | **Shadcn**, **Supabase**                                           | **Style Principles**, **MCP Integration**, **Continuity Ledger**, **Multi-Agent Collaboration**   |
| **4. Verification & Validation** | Manual QA, a11y, perf, E2E, cross‑browser          | `verification.md` + artifacts | **Chrome DevTools**                                                | **MCP Integration**, **Frontend Aesthetics**, **Multi-Agent Collaboration**                       |
| **5. Review & Merge**            | PR, review, evidence, CI green                     | PR links to task              | **GitHub tool** (if configured)                                    | —                                                                                                 |
| **6. Release & Deployment**      | Gradual rollout; metrics & logs                    | Release notes, runbook notes  | **Supabase** (if DB)                                               | **MCP Integration**                                                                               |
| **7. Operate & Improve**         | Monitor, hotfix, retrospective                     | Post‑release notes            | —                                                                  | **Continuity Ledger**                                                                             |

> **Skills**: See `.codex/skills/*/SKILL.md` for Nabatable-specific workflows first, then `~/.codex/skills/*/SKILL.md` for global complements. **MCP**: See §8 and **MCP Integration** (~/.codex/skills/mcp-integration/SKILL.md).

---

## 4) Detailed SDLC Phases (with DoR/DoD & MCP)

### Phase 0 — **Initiation (Task Setup)**

**Apply Skills**:

- **Nabatable Task Harness** (`.codex/skills/nabatable-task-harness/SKILL.md`) — Initialize the repo task folder, AGENTS traversal, and continuity workflow.
- **Continuity Ledger** (~/.codex/skills/continuity-ledger/SKILL.md) — Initialize or update `CONTINUITY.md` for the session.

**Inputs**: Ticket or problem statement.

**Activities**:

- Create `tasks/<slug>-YYYYMMDD-HHMM/` (UTC).
- Stub `research.md` and `plan.md` with frontmatter.

**Exit**: Task folder exists; scope stub recorded.

---

### Phase 1 — **Requirements & Analysis** (`research.md`) — **Definition of Ready**

**Apply Skills**:

- **Nabatable Task Harness** (`.codex/skills/nabatable-task-harness/SKILL.md`) — Keep task artifacts and assumptions aligned with the current scope.
- **Continuity Ledger** (~/.codex/skills/continuity-ledger/SKILL.md) — Track requirements and constraints.
- **MCP Integration** (~/.codex/skills/mcp-integration/SKILL.md) — Use **Codebase Retrieval** to inventory the repo and find reuse/anti-patterns; use **Context7** for up-to-date library docs/examples; use **DeepWiki** for external/domain research summaries when configured (otherwise use web search and prefer primary sources; prefer 2026+ sources unless an older version is required).
- **Multi-Agent Collaboration** (~/.codex/skills/multi-agent-collaboration/SKILL.md) — Parallelize research and reconcile findings.

**Goal**: Understand before building.

**Activities**:

- Inventory codebase for reuse and anti‑patterns.
- Gather functional + non‑functional requirements (a11y, perf, security, privacy, i18n).
- Identify domain constraints/risks; record recommended approach with rationale.
- Capture open questions with owners & due dates.

**Outputs**:

- Reuse list; constraints; risks; external refs and why they matter; recommended direction.

**Definition of Ready (DoR)**

- [ ] Scope & success criteria are clear/measurable.
- [ ] Reuse or "no reusable pattern" is documented.
- [ ] Risks & open questions listed with owners/dates.
- [ ] Owner & reviewers assigned.

**Template** (`research.md`):

```markdown
# Research: <Feature/Change Name>

## Requirements

- Functional:
- Non‑functional (a11y, perf, security, privacy, i18n):

## Existing Patterns & Reuse

- ...

## External Resources

- [Spec/Doc](url) — why it matters

## Constraints & Risks

- ...

## Open Questions (owner, due)

- Q: ...
  A: ...

## Recommended Direction (with rationale)

- ...
```

---

### Phase 2 — **Design & Planning** (`plan.md`)

**Apply Skills**:

- **Nabatable Fullstack Delivery** (`.codex/skills/nabatable-fullstack-delivery/SKILL.md`) — Choose the right feature vs regression vs test-only delivery path before implementation.
- **Frontend Aesthetics** (~/.codex/skills/frontend-aesthetics/SKILL.md) — Define visual direction (typography, color, motion). Avoid "AI slop".
- **Style Principles** (~/.codex/skills/style-principles/SKILL.md) — Apply DRY/KISS/YAGNI to architecture decisions.
- **MCP Integration** (~/.codex/skills/mcp-integration/SKILL.md) — Use **Shadcn** for components; **Supabase** for remote migrations (dry‑run → plan → apply).
- **Multi-Agent Collaboration** (~/.codex/skills/multi-agent-collaboration/SKILL.md) — Coordinate parallel design reviews and edge case discovery.

**Goal**: Turn analysis into an implementable blueprint.

**Activities**:

- Mobile‑first, progressive enhancement; prefer existing components (Shadcn).
- Define architecture, data flow, API contracts, error paths, UI states.
- Define tests and rollout (flags, metrics, kill‑switch).
- **DB:** "staging‑first" migration strategy; expansion→backfill→contraction; rollback plan.

**Outputs**:

- Objective; success criteria; components; contracts; states; edge cases; testing; rollout & observability.

**Template** (`plan.md`):

```markdown
# Implementation Plan: <Feature/Change Name>

## Objective

We will enable <user> to <goal> so that <outcome>.

## Success Criteria

- [ ] <metric/condition>
- [ ] <metric/condition>

## Architecture & Components

- <ComponentA>: role
- <ComponentB>: role
  State: <where/why> | URL state: <...>

## Data Flow & API Contracts

Endpoint: METHOD /api/...
Request: { ... }
Response: { ... }
Errors: { code, message }

## UI/UX States

- Loading / Empty / Error / Success

## Edge Cases

- ...

## Testing Strategy

- Unit / Integration / E2E / Accessibility

## Rollout

- Feature flag: <flag_name> (namespace: feat.<area>.<name>)
- Exposure: 10% → 50% → 100%
- Monitoring: <dashboards/metrics>
- Kill‑switch: <how to disable safely>

## DB Change Plan (if applicable)

- Target envs: staging → production (window: <time>)
- Backup reference: <snapshot/PITR link>
- Dry‑run evidence: `artifacts/db-diff.txt`
- Backfill strategy: <chunk size, idempotency>
- Rollback plan: <steps/compensating migration>
```

---

### Phase 3 — **Implementation** (`todo.md`)

**Apply Skills**:

- **Nabatable Fullstack Delivery** (`.codex/skills/nabatable-fullstack-delivery/SKILL.md`) — Keep changes on the canonical path and align test strategy with the task type.
- **Style Principles** (~/.codex/skills/style-principles/SKILL.md) — Write simple, focused code. Avoid over-engineering.
- **MCP Integration** (~/.codex/skills/mcp-integration/SKILL.md) — Use **Shadcn** to scaffold UI; **Supabase** for migrations; use **Codebase Retrieval** to locate existing implementations before adding new paths.
- **Continuity Ledger** (~/.codex/skills/continuity-ledger/SKILL.md) — Update progress state (Done/Now/Next).
- **Multi-Agent Collaboration** (~/.codex/skills/multi-agent-collaboration/SKILL.md) — Partition work and avoid overlapping edits.

**Goal**: Execute with momentum and traceability.

**Activities**:

- Track atomic steps; log deviations & assumptions.
- Implement code, components, remote migrations, and tests.
- Keep changes **narrow and focused** per §1B (no opportunistic refactors).

**Template** (`todo.md`):

```markdown
# Implementation Checklist

## Setup

- [ ] Create/extend components (Shadcn-first; exception noted if any)
- [ ] Add feature flag <flag_name> (default off)

## Core

- [ ] Data fetching / mutations
- [ ] Validation & error surfaces
- [ ] URL/state sync & navigation

## UI/UX

- [ ] Responsive layout
- [ ] Loading/empty/error states
- [ ] A11y roles, labels, focus mgmt

## Tests

- [ ] Unit
- [ ] Integration
- [ ] E2E (critical flows)
- [ ] Axe/Accessibility checks

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- ...
```

---

### Phase 4 — **Verification & Validation** (`verification.md`) — **Definition of Done**

**Apply Skills**:

- **Nabatable UI Proof** (`.codex/skills/nabatable-ui-proof/SKILL.md`) — Use the repo's verification fallback rules for stale harnesses, auth-gated routes, and test-only work.
- **MCP Integration** (~/.codex/skills/mcp-integration/SKILL.md) — **MANDATORY**: Use **Chrome DevTools MCP** for UI QA.
- **Frontend Aesthetics** (~/.codex/skills/frontend-aesthetics/SKILL.md) — Verify "stop scrolling" quality and brand alignment.
- **Multi-Agent Collaboration** (~/.codex/skills/multi-agent-collaboration/SKILL.md) — Parallelize QA while keeping a single source of truth for artifacts.

**Goal**: Prove it works, is accessible, and performs.

**Activities**:

- **Chrome DevTools MCP Manual QA**: console/network; device emulation; profiling; Lighthouse; a11y.
- If the UI route is **auth-gated** (or otherwise unreachable) in local dev, create a **dev-only harness route** to satisfy the DevTools MCP requirement:
  - Location: `src/app/(public)/dev/<harness>/page.tsx` (and optionally `src/app/app/dev/<harness>/page.tsx` to validate `/app/*` base-path behavior without going through the protected `(app)` layout group).
  - Guard: call `enforceDevOnly()` from `src/app/(public)/dev/_shared/enforceDevOnly.ts` at the **server component boundary** so the harness is never reachable in non-dev environments.
- Cross‑browser smoke where relevant.
- Validate edge cases & error paths; perf budgets; basic security checks.
- Attach artifacts in `artifacts/` (Lighthouse JSON, HAR, traces, screenshots, db diff).

**Budgets (mobile; 4× CPU; 4G)**

- FCP ≤ **2.0 s** · LCP ≤ **2.5 s** · CLS ≤ **0.10** · TBT ≤ **200 ms**
- Axe: **0** critical/serious issues
- Critical interaction latency: **P95 ≤ 500 ms**

**Definition of Done (DoD)**

- [ ] Requirements met; success criteria satisfied.
- [ ] All tests pass (unit/integration/E2E/a11y).
- [ ] Perf/a11y budgets met; no P0/P1.
- [ ] `verification.md` completed with artifacts.
- [ ] Docs/changelogs updated; flags & runbooks documented.

**Template** (`verification.md`):

```markdown
# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [x] No Console errors
- [x] Network requests match contract

### DOM & Accessibility

- [x] Semantic HTML verified
- [x] ARIA attributes correct
- [x] Focus order logical & visible
- [x] Keyboard-only flows succeed

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: <value> s | LCP: <value> s | CLS: <value> | TBT: <value> ms
- Budgets met: [ ] Yes [ ] No (notes)

### Device Emulation

- [x] Mobile (≈375px) [x] Tablet (≈768px) [x] Desktop (≥1280px)

## Test Outcomes

- [x] Happy paths
- [x] Error handling
- [x] A11y (axe): 0 critical/serious

## Artifacts

- Lighthouse: `artifacts/lighthouse-report.json`
- Network: `artifacts/network.har`
- Traces/Screens: `artifacts/`
- DB diff (if DB change): `artifacts/db-diff.txt`

## Known Issues

- [ ] <issue> (owner, priority)

## Sign‑off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA
```

---

### Phase 5 — **Review & Merge**

**Activities**:

- Open PR; reference task directory; include evidence and checklists.
- Use **Conventional Commits** in PR title (`feat: ...`, `fix: ...`).
- Attach UI screenshots/clips and link to `verification.md`.

**Exit**: Approvals obtained; CI green; merged per repo policy.

**PR Checklist** (include in PR description):

```text
[ ] Links to task folder and ticket
[ ] Screenshots/clips (UI) + verification.md
[ ] Tests added/updated
[ ] A11y verified (keyboard, SR cues)
[ ] Perf budgets met (Lighthouse attached)
[ ] Docs/changelogs updated if needed
```

---

### Phase 6 — **Release & Deployment**

**Apply Skills**:

- **MCP Integration** (~/.codex/skills/mcp-integration/SKILL.md) — Use **Supabase MCP** for remote migrations (staging → prod).

**Activities**:

- Roll out per plan; monitor metrics/logs; keep flag guardrails.
- Apply DB changes **staging first**, then production in a window with approvals.
- Document outcomes in task folder.

**Exit**: Stable at 100%; final notes added to task.

---

### Phase 7 — **Operate & Improve**

**Apply Skills**:

- **Continuity Ledger** (~/.codex/skills/continuity-ledger/SKILL.md) — Capture learnings in ledger and task folder.

**Activities**:

- Monitor SLOs; triage incidents; capture learnings.
- File follow‑ups; schedule refactors/tech debt as tasks.

**Exit**: Learnings captured; backlog updated.

---

## 5) Frontend: Component & UX Standards

> **Ref**: See **Frontend Aesthetics** (~/.codex/skills/frontend-aesthetics/SKILL.md) for detailed design guidelines including typography, color, motion, and anti-patterns.

### Components

- **Use SHADCN UI primitives via Shadcn MCP** for all UI; extend and compose rather than rebuild.
- **Exceptions**: Only with maintainer approval when no Shadcn equivalent supports required a11y/UX; document justification in `plan.md` and get design sign‑off.

### Mobile‑First & Progressive Enhancement

- Build for small screens first; enhance for larger screens.
- Core flows should degrade gracefully with minimal JS where reasonable.

### Accessibility (must‑haves)

- Full keyboard navigation; manage focus (trap in modals; restore on close).
- Visible focus via `:focus-visible`.
- Prefer semantic HTML; add ARIA only when necessary.
- Provide accessible names/labels; avoid color‑only cues.
- Hierarchical headings; per‑view titles.
- Toasts/validation use polite `aria-live`.

### Forms

- Inputs ≥16px font on mobile.
- Correct `type`, `inputmode`, `autocomplete`.
- Submit triggers inline validation; focus first error.
- Submit remains enabled until request starts; show non‑blocking spinners.
- Permit paste; trim values; warn on unsaved changes.
- `Enter` submits single‑line; `Ctrl/⌘+Enter` submits textareas.

### Navigation & State

- Reflect state in URL (filters, tabs, pagination).
- Restore scroll on back/forward.
- Use `<a>/<Link>` for new‑tab & middle‑click.

### Touch & Targets

- Hit area ≥24px (mobile ≥44px). Increase padding if visuals are smaller.
- `touch-action: manipulation` where appropriate.

### Motion & Layout

- Respect `prefers-reduced-motion`.
- Animate only `transform`/`opacity`; animations are interruptible.
- Test mobile, laptop, ultra‑wide; avoid accidental scrollbars.
- Respect safe areas with `env(safe-area-inset-*)`.

### Performance

- Minimize re‑renders; virtualize large lists.
- Prevent image‑induced CLS (reserve space).
- Target <500ms for common user‑visible mutations (P95).

---

## 6) Back End & Data

> **Ref**: See **MCP Integration** (~/.codex/skills/mcp-integration/SKILL.md) for Supabase workflows and safety checklists.

### Supabase — **Remote Only**

- **Never** run local Supabase for this project.
- All migrations/seeds target **remote** environments (staging/prod per plan).
- **Staging‑first** apply; production requires protected env + approval.

**MCP‑first operations**

- Use **Supabase MCP** to:
  - Preview migrations (dry run) → attach output to `artifacts/db-diff.txt`.
  - Apply to **target remote** (staging → prod).
  - Capture migration IDs and rollback steps in `verification.md`.

**Safety**

- Expansion → backfill → contraction.
- Avoid long‑running locking transactions; chunk backfills with idempotency.
- Verify backups/PITR before impactful schema changes.
- Production applies occur in a change window with on‑call acknowledged.

---

## 7) Nested AGENTS.md (Subprojects)

> Discovery rules in §1.5 apply. Additions/overrides only; root rules remain in force.

### Template (Nested)

```markdown
---
agents_version: 5.4
scope: subproject
extends: ../../AGENTS.md
last_updated: 2025-12-22
owner: github:@<team>
profile: web-next|mobile|service-python|package-ui
---

# AGENTS.md — <Subproject Name>

> Inherits main AGENTS.md. Additions/overrides below.

## Overview

<Brief purpose and scope>

## Build & Test Commands

- `pnpm run dev`
- `pnpm run build`
- `pnpm run test`
- `pnpm run lint`

## Subproject-Specific Guidelines

### Code Conventions

- <Naming, file organization>

### Testing

- <Location/structure, coverage expectations>

### Deployment

- <Process for this subproject>

## Links

- Main docs: <url>
- API reference: <url>
```

### Example Monorepo Layout

Global skills live outside the repo at `~/.codex/skills/` (not shown in the tree below).

```text
/
├── AGENTS.md
├── apps/
│   ├── web/AGENTS.md
│   ├── mobile/AGENTS.md
│   └── admin/AGENTS.md
├── packages/
│   ├── ui/AGENTS.md
│   ├── api-client/AGENTS.md
│   └── database/AGENTS.md
└── infrastructure/AGENTS.md
```

---

## 8) MCP Tooling & Integrations (Catalog + Rules)

> **Ref**: See **MCP Integration** (~/.codex/skills/mcp-integration/SKILL.md) for detailed workflows, pre-flight checklists, and examples.

Use MCP when it provides **repeatability, safety, or scale**. Configure via env/secrets; do not commit tokens.

- **Chrome DevTools MCP** — Manual QA (console/network, emulation, performance, Lighthouse/a11y).  
  **Phase**: 4. **Rule**: Required for any UI change; attach artifacts.
- **Shadcn MCP** — Discover/scaffold UI components, synchronize tokens.  
  **Phases**: 2, 3. **Rule**: Prefer SHADCN before custom.
- **Supabase MCP** — Remote migrations/seeds; schema drift; rollback plans.  
  **Phases**: 2, 3, 6. **Rule**: **Remote only**; connections via secrets.
- **Codebase Retrieval (Augment) MCP** — Fast semantic search across the repo (best first step when you don't know file locations).  
  **Phases**: 1, 2, 3.
- **Context7 MCP** — Up-to-date documentation + code examples for third-party libraries and frameworks.  
  **Phases**: 1, 2, 3.
- **DeepWiki MCP** — External/domain research summaries (may be disabled/unavailable in some environments; treat as optional).  
  **Phases**: 1.
- **PostHog MCP** — Analytics, feature flags, experiments, surveys (when PostHog is part of the change).  
  **Phases**: 2, 5, 7.

### Skills & Prompts (Codex)

- Skills live in `.codex/skills/` (repo) and `~/.codex/skills/` (global).
- For Nabatable work, prefer repo-local foundation skills first when they match: `nabatable-task-harness`, `nabatable-ui-proof`, `nabatable-fullstack-delivery`.
- If a `$SkillName` is referenced and not present locally, load `~/.codex/skills/<skill-name>/SKILL.md` (plus any `references/` and `scripts/` referenced by that skill).
- Skill triggers: if the user names a skill (e.g. `$SkillName`) or the task matches the skill’s `description`, you must use that skill for that turn.
- Skill consumption: open the relevant `SKILL.md` and read only enough to follow the workflow (load only the specific `references/` files needed; prefer running/patching `scripts/` over retyping).
- If a named skill isn’t available or can’t be read, say so briefly and proceed with the best fallback approach.
- Prompts live in `~/.codex/prompts/*.md`.

### Shell Discipline (Agents)

- Prefer deterministic, non-interactive commands; limit output (`head`) and pick a single result consistently.
- Prefer built-in file/search tools when available; use the shell as a deterministic fallback.
- For searching: use `fd` (files), `rg` (text), `ast-grep` (syntax-aware).
- For structured extraction/transform: use `jq` / `yq`.

**If MCP unavailable temporarily**: run equivalent CLI/manual steps and attach artifacts. MCP usage is still **required** long‑term.

---

## 8.5) Multi-Agent Collaboration (Codex Agents)

> **Ref**: See **Multi-Agent Collaboration** (~/.codex/skills/multi-agent-collaboration/SKILL.md) for workflows, roles, and checklists.

Use multiple agents to **parallelize research, analysis, and verification**, not to create conflicting edits.

**Rules**

- **Single lead**: One agent owns repo edits, task artifacts, and final decisions.
- **Clear scopes**: Assign non-overlapping file or domain ownership before work starts.
- **Shared constraints**: Every agent must receive the non-negotiables (security, Supabase remote-only, a11y, Shadcn, DevTools MCP).
- **Artifact discipline**: Capture each agent's findings in the task folder (research/plan/verification notes or artifacts) with concise summaries.
- **Parallel edits**: If files change unexpectedly, assume parallel edits; keep your diff scoped. Stop only for conflicts/breakage, then ask for clarification.
- **MCP precedence**: When MCP outputs exist, treat them as the source of truth and reconcile multi-agent findings accordingly.

**tAF Subagents**

- ALWAYS wait for all subagents to complete before yielding.
- Spawn subagents automatically when:
  - Parallelizable work (e.g., install + verify, npm test + typecheck, multiple tasks from plan)
  - Long-running or blocking tasks where a worker can run independently.
  - Isolation for risky changes or checks.

---

## 8.6) Skills + Shell Execution Practices

> **Ref**: [How to use Codex with skills, shell commands, and compaction](https://developers.openai.com/blog/skills-shell-tips).

Use these rules to convert repeat work into reliable, reusable execution patterns.

**Skills-first for recurring work**

- If a workflow repeats two or more times, use an existing skill or create/update one in `~/.codex/skills/`.
- Skills must include: trigger conditions, required inputs, deterministic command patterns, and verification steps.
- Keep skills narrow and composable; avoid broad "do everything" skills.

**Prompt and planning discipline**

- Before implementation, write a concise state summary (what is true now), desired end state, and measurable success criteria.
- Create or update `todo.md` with atomic steps before file edits for non-trivial tasks.
- Include expected failure branches and next actions in the plan for likely breakpoints.

**Shell reliability defaults**

- For multi-step shell flows, run with `set -euo pipefail` and explicit quoting.
- Prefer robust iteration patterns (`while IFS= read -r`) over brittle command substitution (`for f in $(...)`).
- Use `jq`/`yq` for structured parsing instead of regex parsing JSON/YAML where possible.
- Use `trap` cleanup for temporary files/background processes.

**Long-running and parallel execution**

- Prefer `tmux` sessions for long-running local jobs when available; keep session names deterministic per task.
- Record long-running command purpose and outputs in task artifacts so work can be resumed after interruptions.

**Compaction-safe execution**

- Treat context compaction as normal operation; persist decisions, commands, and next actions in `CONTINUITY.md` and task files.
- Do not rely on chat memory for critical state; if it matters, write it to disk.

---

## 8.7) Shell Tool Runtime & Security Policy

> **Ref**: [Tools: Shell (OpenAI API docs)](https://developers.openai.com/api/docs/guides/tools-shell), [How to use Codex with skills, shell commands, and compaction](https://developers.openai.com/blog/skills-shell-tips).

Apply these controls whenever shell tooling is used in agent workflows.

**Runtime selection**

- Choose runtime intentionally:
  - **Hosted shell** for isolated, ephemeral execution and reproducible artifact capture.
  - **Local shell** only when host access is required and the target workspace/environment is trusted.
- Record runtime choice and rationale in task artifacts for non-trivial tasks.

**Hosted-shell storage boundary**

- In hosted shell, treat `/mnt/data` as the writable artifact boundary.
- Persist required outputs from hosted runs into `tasks/<slug>-YYYYMMDD-HHMM>/artifacts/` before ending the task.

**Network and outbound access**

- Default to no outbound network access unless required by the task.
- When network is required, configure `network_policy` with least privilege.
- `network_policy` must be a subset of the organization allowlist; do not assume it can expand organization-level permissions.
- For authenticated outbound requests, use `domain_secrets` per domain and least-privilege credentials only.

**Session continuity for multi-turn shell work**

- For follow-up tool calls in the same workflow, reuse `previous_response_id` and `container_reference` when available.
- If a container/session expires, recover state from `CONTINUITY.md` and task artifacts before resuming.

**Execution safety**

- Keep shell commands deterministic and non-interactive by default.
- Capture command, exit status, and key outputs in verification artifacts for critical workflows.
- Fail fast on non-zero exits unless explicitly handled as an expected branch.
- Never print or persist secrets in command output, logs, or artifacts.

---

## 9) Git & Branching

- **Branch**: `codex/task/<slug>-YYYYMMDD-HHMM` (Codex) or `task/<slug>-YYYYMMDD-HHMM` (short‑lived; trunk‑based; squash merges).
- **Commits**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
- **GitHub operations**: Use `gh` CLI for issues/PRs/releases.
- **Push policy**: Ask before any `git push` (agents should not push unless explicitly requested).
- **PR format**: Keep PRs short and structured: **Why** (1–2 bullets), **How** (1–3 bullets), **Tests** (commands run + results). Avoid noise (logs/dumps); include screenshots/clips when UX changes.
- **PRs**: Must reference the task folder path and include evidence (screens, clips, Lighthouse, HAR, traces).

---

## 10) Red Flags, Stop Signs & Waivers

Escalate or stop immediately if:

- No reusable pattern exists for a risky area → **request design/arch review**.
- Requirements ambiguous → **clarify in Phase 1** before coding.
- Scope too large → **split into multiple tasks**.
- Assumptions stack up → **document & validate with maintainer**.
- No verification plan → **define success criteria** first.
- Skipping **DevTools MCP** QA for UI → **not allowed**.
- Attempting **local** Supabase migrations/seeds → **not allowed**.
- Secrets appear in diffs or artifacts → **block PR** until removed.

### 10.1 Waiver / Hotfix Flow (exception path)

- **Use only for urgent hotfixes (P0/P1).**
- Branch: `codex/hotfix/<slug>-YYYYMMDD-HHMM` (Codex) or `hotfix/<slug>-YYYYMMDD-HHMM`.
- Minimal `research.md`/`plan.md` allowed if risk explicitly documented.
- **Post‑merge within 24h**: complete full Phase 4, attach artifacts, and file retro in Phase 7.
- Approvals: Maintainer + QA Lead; time‑boxed waiver (≤72h).

---

## 11) Quick Reference Checklists

**Task Lifecycle**

```text
[ ] Check for AGENTS.md (§1.5); create if missing
[ ] Create task dir (UTC timestamp)
[ ] Requirements & analysis → research.md (DoR met)
[ ] Design/plan → plan.md
[ ] Implementation → todo.md
[ ] Verification → verification.md + artifacts (DoD met)
[ ] Approvals & merge
[ ] Release & monitor; notes added
[ ] Post‑release learnings filed (tickets)
```

**Skills + Shell Execution**

```text
[ ] Reuse/create a skill for repeated workflows (2+ repeats)
[ ] Capture state, target outcome, and success criteria before implementation
[ ] Maintain atomic checklist in todo.md for non-trivial changes
[ ] Use robust shell defaults (`set -euo pipefail`, quoted vars, safe loops)
[ ] Capture verification commands and outcomes in verification.md
[ ] Persist key decisions and next actions in CONTINUITY.md
```

**Shell Tool Runtime**

```text
[ ] Runtime selected intentionally (hosted vs local) and documented
[ ] Hosted-shell outputs saved from `/mnt/data` into task artifacts
[ ] Outbound access restricted via least-privilege `network_policy`
[ ] Authenticated domains configured with `domain_secrets`
[ ] Multi-turn shell calls reuse `previous_response_id` + `container_reference` when available
[ ] Commands are non-interactive, fail-fast, and have recorded exit status
```

**UI/A11y Essentials**

```text
[ ] Keyboard‑only flows succeed
[ ] Visible focus management
[ ] Semantic roles/labels
[ ] URL reflects state
[ ] Loading/empty/error states implemented
[ ] No CLS from media; images sized
```

**Perf Budgets (mobile; 4× CPU; 4G)**

```text
[ ] FCP ≤ 2.0 s
[ ] LCP ≤ 2.5 s
[ ] CLS ≤ 0.10
[ ] TBT ≤ 200 ms
[ ] Critical interaction P95 ≤ 500 ms
```

**Data & Migrations**

```text
[ ] Remote Supabase only (via MCP)
[ ] Staging first, then production (window + approval)
[ ] Backup/rollback plan noted
[ ] Dry-run(diff) artifact attached
[ ] Migration logged in docs/DATABASE_MIGRATIONS.md
```

> **Migration Log**: See `docs/DATABASE_MIGRATIONS.md` for tracking staging → production database changes.

**Security & Privacy**

```text
[ ] Secrets not committed; env only
[ ] PII minimized/redacted in logs
[ ] Auth & authorization paths tested
```

---

## 12) Key Questions Before You Start

1. Who is the user and what exact problem are we solving?
2. What can we **reuse** from the codebase?
3. What are the edge cases and failure modes?
4. What does **success** look like (metrics, states, acceptance criteria)?
5. What could go wrong, and what is our mitigation/rollback?

---

## 13) Appendices

### A) RACI (by Phase)

| Phase             | Responsible            | Accountable     | Consulted            | Informed |
| ----------------- | ---------------------- | --------------- | -------------------- | -------- |
| 1. Requirements   | Feature Eng / AI Agent | Tech Lead       | PM, Design, Security | QA       |
| 2. Design         | Feature Eng            | Tech Lead       | DB Eng, A11y SME     | QA       |
| 3. Implementation | Feature Eng            | Tech Lead       | Maintainers          | PM       |
| 4. Verification   | QA + Feature Eng       | QA Lead         | A11y SME, Perf       | PM       |
| 5. Review/Merge   | Reviewers              | Repo Maintainer | Security             | All      |
| 6. Release        | Release Manager        | Eng Manager     | SRE, Support         | All      |
| 7. Operate        | SRE/On‑call            | Eng Manager     | PM                   | All      |

### B) Style Principles (Summary)

> **Ref**: See **Style Principles** (~/.codex/skills/style-principles/SKILL.md) for full details with examples.

- **DRY**: Reuse patterns/components.
- **KISS**: Prefer simple, obvious solutions.
- **YAGNI**: Build only what's needed now.

### C) MCP Pre‑Flight (copy into `verification.md` when MCP is used)

```text
[ ] Server reachable (version printed)
[ ] Session token valid (if required)
[ ] Secrets sourced via env (not logged)
[ ] Target environment confirmed (staging/prod)
```

### D) Security Baselines

- **Secret scanning** required (e.g., Gitleaks/Trufflehog) on every PR.
- **SAST** (e.g., CodeQL/Semgrep) on default branches and PRs.
- **Dependency audit** (pnpm/yarn/npm audit) with allowlisted exceptions only.
- **SBOM** generation for release builds if applicable.
- **Commit signing** recommended; protected environments for production.

### E) PR Template (drop in `.github/PULL_REQUEST_TEMPLATE.md`)

```markdown
## Summary

<What and why>

## Task & Tickets

- Task folder: `tasks/<slug>-YYYYMMDD-HHMM>`
- Ticket: <link>

## Evidence

- [ ] `verification.md` updated
- [ ] Screenshots/clips for UI changes
- [ ] Metrics/perf notes (if applicable)
- [ ] Lighthouse JSON + HAR attached in `artifacts/`

## Checklists

**Definition of Ready (Phase 1)**

- [ ] Scope & success criteria clear
- [ ] Reuse identified or N/A
- [ ] Risks & open Qs tracked with owners

**Definition of Done (Phase 4)**

- [ ] All tests pass (unit/integration/E2E/a11y)
- [ ] Perf/a11y thresholds met; no P0/P1
- [ ] Docs/changelog updated
- [ ] Rollout plan & flag documented

## Notes

<assumptions/deviations>
```

### F) CODEOWNERS (excerpt)

```text
# Cross-cutting
/AGENTS.md                 @maintainers
/tasks/                    @release-managers @maintainers
/supabase/migrations/      @db-owners

# Apps
/apps/web/                 @web-core
/apps/mobile/              @mobile-core
/packages/ui/              @design-systems
```

### G) CI Enforcement (policy‑as‑code)

**agents-guards.yml** (example)

```yaml
name: Agents Guards
on: [pull_request]
jobs:
  guards:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: pnpm install --frozen-lockfile || npm ci
      - run: node scripts/check-agents-compliance.cjs
```

**scripts/check-agents-compliance.cjs**

```js
const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

// 1) Root file must be exactly /AGENTS.md
if (!fs.existsSync(path.join(process.cwd(), 'AGENTS.md'))) {
  console.error('Missing required root /AGENTS.md (exact casing).');
  process.exit(1);
}

// 2) Validate all nested AGENTS.md have scope: subproject and a non-null extends:
function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') yield* walk(p);
    else if (e.isFile() && e.name === 'AGENTS.md' && p !== path.join(process.cwd(), 'AGENTS.md'))
      yield p;
  }
}
let ok = true;
for (const p of walk(process.cwd())) {
  const content = read(p);
  const hasScope = /scope:\s*subproject\b/.test(content);
  const hasExt = /extends:\s+(\.\.\/)+AGENTS\.md\b/.test(content);
  if (!hasScope || !hasExt) {
    console.error(
      `Nested ${p} must declare 'scope: subproject' and a valid 'extends: ../../AGENTS.md' path.`,
    );
    ok = false;
  }
}
if (!ok) process.exit(1);
console.log('AGENTS policy checks passed.');
```

### H) Policy‑Trace Script (confirm effective stack)

**scripts/agents-policy-trace.ts**

```ts
import fs from 'fs';
import path from 'path';

function walkAgents(startFile: string) {
  const stack: string[] = [];
  let dir = path.resolve(path.dirname(startFile));
  while (true) {
    const p = path.join(dir, 'AGENTS.md'); // exact casing
    if (fs.existsSync(p)) stack.push(p);
    const parent = path.resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return stack.reverse(); // root -> ... -> closest
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error('Usage: ts-node scripts/agents-policy-trace.ts <path/to/file>');
  process.exit(1);
}
for (const f of targets) {
  const stack = walkAgents(f);
  console.log(`\n${f}\nEffective AGENTS stack:`);
  stack.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
}
```

Usage:

```bash
pnpm ts-node scripts/agents-policy-trace.ts apps/web/src/pages/index.tsx
```

---

## 14) Continuity Ledger (Compaction-Safe)

> **Ref**: See **Continuity Ledger** (~/.codex/skills/continuity-ledger/SKILL.md) for full details, examples, and anti-patterns.

Maintain a single Continuity Ledger for this workspace in `CONTINUITY.md`. The ledger is the canonical session briefing designed to survive context compaction; do not rely on earlier chat text unless it's reflected in the ledger.

### How it works

- **At the start of every assistant turn**: read `CONTINUITY.md`, update it to reflect the latest goal/constraints/decisions/state, then proceed with the work.
- **Update `CONTINUITY.md`** whenever any of these change: goal, constraints/assumptions, key decisions, progress state (Done/Now/Next), or important tool outcomes.
- Keep it **short and stable**: facts only, no transcripts. Prefer bullets. Mark uncertainty as `UNCONFIRMED` (never guess).
- If you notice missing recall or a compaction/summary event: refresh/rebuild the ledger from visible context, mark gaps `UNCONFIRMED`, ask up to 1–3 targeted questions, then continue.

### `CONTINUITY.md` format (keep headings)

```markdown
# Continuity Ledger

Last updated: <ISO-8601 timestamp>

## Goal (incl. success criteria)

- ...

## Constraints/Assumptions

- ...

## Key decisions

- ...

## State

- ...

## Done

- ...

## Now

- ...

## Next

- ...

## Open questions (UNCONFIRMED if needed)

- ...

## Working set (files/ids/commands)

- ...
```

---

**Last Updated**: 2026‑03-31  
**Version**: 5.4

**Skills Directory**: See `.codex/skills/` for repo-local Nabatable capabilities first, then `~/.codex/skills/` for global capabilities:

- **Nabatable Task Harness** (`.codex/skills/nabatable-task-harness/SKILL.md`) — Task setup, AGENTS alignment, continuity, and artifact discipline
- **Nabatable UI Proof** (`.codex/skills/nabatable-ui-proof/SKILL.md`) — Nabatable UI verification and fallback browser-proof workflow
- **Nabatable Fullstack Delivery** (`.codex/skills/nabatable-fullstack-delivery/SKILL.md`) — Feature vs regression vs test-only delivery guidance

- **Continuity Ledger** (~/.codex/skills/continuity-ledger/SKILL.md) — Session continuity pattern
- **Multi-Agent Collaboration** (~/.codex/skills/multi-agent-collaboration/SKILL.md) — Multi-agent coordination and conflict avoidance
- **Frontend Aesthetics** (~/.codex/skills/frontend-aesthetics/SKILL.md) — UI design principles
- **MCP Integration** (~/.codex/skills/mcp-integration/SKILL.md) — MCP server catalog and workflows
- **Style Principles** (~/.codex/skills/style-principles/SKILL.md) — DRY/KISS/YAGNI guidelines
- **Agent Skills Ecosystem** (~/.codex/skills/agent-skills-ecosystem/SKILL.md) — Meta-information about the skills format
