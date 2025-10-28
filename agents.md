# AGENTS.md

**SDLC‑aligned operating handbook for AI coding agents and human contributors (with MCP tooling)**

> Deliver reliable software changes using the same structure every time—mapped to a clear SDLC and powered by MCP where it adds the most value.

---

## 0) Scope & Audience

- **Who**: AI coding agents, human engineers, reviewers, maintainers, and release managers in this repository.
- **What**: The authoritative SDLC, workflow, quality bars, file structure, conventions, and MCP tool usage for any change (feature, fix, refactor, experiment).
- **Why**: Consistency, traceability, safe iteration—especially in monorepos and multi‑app repos.

---

## 1) Non‑Negotiables (Read First)

1. **Follow the SDLC phases in order.** No coding before requirements & plan are reviewed.
2. **Everything is a Task** with its own time‑stamped directory and artifacts.
3. **Manual UI QA via Chrome DevTools (MCP) is mandatory** for any UI change.
4. **Supabase: remote only.** Never run migrations or seeds against a local instance for this project.
5. **Prefer existing patterns** (DRY/KISS/YAGNI). **Use SHADCN UI** (via **Shadcn MCP**) before building custom components.
6. **Accessibility is required** (WCAG/WAI‑ARIA APG). No exceptions.
7. **Document assumptions & deviations** from the plan inside the task folder.
8. **Secrets never in source.** Use env vars / secret stores; never commit tokens.
9. **Conventional Commits** and **PR templates** are enforced.

---

## 2) Task Structure & Naming

- **Directory**: `tasks/<slug>-YYYYMMDD-HHMM/` (UTC timestamp).
  - Slug examples: `user-auth-flow`, `payment-gateway-integration`, `fix-avatar-cropping`.
  - Timestamp format: `YYYYMMDD-HHMM` (e.g., `20250110-1430` → 2025‑01‑10 14:30 UTC).

**Required files**

```
tasks/<slug>-YYYYMMDD-HHMM/
├── research.md      # Requirements & analysis: what exists, reuse, constraints, references
├── plan.md          # Design/plan: objective, architecture, API, states, tests, rollout
├── todo.md          # Implementation checklist (atomic steps)
└── verification.md  # Verification: manual QA, test outcomes, performance, sign-offs
```

**Example**
`tasks/user-authentication-flow-20250110-1430/`

---

## 3) SDLC at a Glance (Map → Artifacts → MCP)

| SDLC Phase                       | What happens                                            | Primary Artifacts            | Gate / Exit Criteria                                  | Required MCP(s)                                         |
| -------------------------------- | ------------------------------------------------------- | ---------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| **0. Initiation**                | Create task, define scope stub                          | Task folder, stubs           | Folder exists; basic scope noted                      | —                                                       |
| **1. Requirements & Analysis**   | Inventory current code, clarify requirements, risks     | `research.md`                | Clear, justified approach; constraints/risks explicit | **Context7 MCP**, **DeepWiki MCP**, **Atlassian MCP**   |
| **2. Design & Planning**         | Architecture, contracts, UX states, test & rollout plan | `plan.md`                    | Reviewer can approve build without a meeting          | **Shadcn MCP**, **Supabase MCP**, **Next DevTools MCP** |
| **3. Implementation**            | Code, migrations, components, unit tests                | `todo.md` (live)             | Core complete; local tests pass                       | **Shadcn MCP**, **Supabase MCP**, **Next DevTools MCP** |
| **4. Verification & Validation** | Manual QA, a11y, perf, E2E, cross‑browser               | `verification.md`            | Meets success criteria; no P0/P1; sign‑offs           | **Chrome DevTools MCP**                                 |
| **5. Review & Merge**            | PR, review, evidence, CI green                          | PR links to task             | Approvals obtained; CI green; merge per policy        | **GitHub tool** (if available), **Atlassian MCP**       |
| **6. Release & Deployment**      | Gradual rollout; metrics & logs                         | Release notes, runbook notes | Stable at 100%; no regressions                        | **Supabase MCP** (if DB), Observability stack           |
| **7. Operate & Improve**         | Monitor, hotfix, retrospective                          | Post‑release notes           | Learnings captured; tickets filed                     | **Atlassian MCP**                                       |

> **Note**: MCP names refer to your configured servers (see §8). Use placeholders/env vars—never commit real tokens.

---

## 4) Detailed SDLC Phases (with MCP usage)

### Phase 0 — **Initiation (Task Setup)**

**Inputs**: Ticket, problem statement, or spike.
**Activities**:

- Create `tasks/<slug>-YYYYMMDD-HHMM/` (UTC).
- Capture initial scope + success criteria (brief).
  **Outputs**:
- Folder + stubbed `research.md` & `plan.md`.
  **Exit**:
- Task folder exists with named objective stub.

---

### Phase 1 — **Requirements & Analysis** (`research.md`)

**Goal**: Understand before building.

**Activities**:

- Inventory codebase for reuse opportunities & anti‑patterns.
- Gather requirements (functional + non‑functional: a11y, perf budgets, security, privacy).
- Identify domain constraints, risks, and open questions.
- Record a recommended approach with rationale.

**Use MCP here**

- **Context7 MCP**: semantic search across internal docs/specs/prior art.
- **DeepWiki MCP**: external/domain references (summaries, RFCs).
- **Atlassian MCP**: pull ticket description/ACs; update questions/notes back to the ticket if applicable.

**Outputs (`research.md`)**

- Existing patterns/components/utilities to reuse.
- External references & why they matter.
- Constraints (tech, performance, security, product).
- Open Q&A (resolved/owner).
- Recommended direction (with rationale).

**Exit**: A reasoned recommendation; risks & constraints explicit.

**Template**

```markdown
# Research: <Feature/Change Name>

## Requirements

- Functional:
- Non‑functional (a11y, perf, security, privacy, i18n):

## Existing Patterns & Reuse

- ...

## External Resources

- [Spec/Doc](url) – why it matters

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

**Goal**: Turn analysis into an implementable blueprint.

**Activities**:

- Mobile‑first, progressive enhancement; favor existing components.
- Define architecture, data flow, API contracts, error paths.
- Define UI states; plan tests and rollout (flags/metrics).

**Use MCP here**

- **Shadcn MCP**: discover existing components, scaffold variants, align tokens.
- **Supabase MCP**: design migrations/seeds safely **against remote**; prepare rollback/backup plan.
- **Next DevTools MCP**: inspect routing, bundle, server/client boundaries for Next.js apps.

**Outputs (`plan.md`)**

- Objective, success criteria (measurable).
- Architecture & components (state ownership, URL state).
- API contracts (request/response/errors).
- UI/UX states (loading/empty/error/success).
- Edge cases & failure handling.
- Testing strategy (unit/integration/E2E/a11y).
- Rollout plan (flags, exposure steps, metrics, kill‑switch).

**Exit**: Reviewer can say “yes, build this.”

**Template**

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

- Loading: ...
- Empty: ...
- Error: ...
- Success: ...

## Edge Cases

- ...

## Testing Strategy

- Unit: ...
- Integration: ...
- E2E: ...
- Accessibility: ...

## Rollout

- Feature flag: <flag_name>
- Exposure: 10% → 50% → 100%
- Monitoring: <metrics/logs/dashboards>
- Kill‑switch: <how to disable safely>
```

---

### Phase 3 — **Implementation** (`todo.md`)

**Goal**: Execute with momentum and traceability.

**Activities**:

- Break work into atomic steps; keep the checklist living.
- Implement code, components, migrations (remote), and tests.
- Log deviations & assumptions.

**Use MCP here**

- **Shadcn MCP**: scaffold/extend UI components; adhere to design tokens.
- **Supabase MCP**: run **remote** migrations/seeds with dry‑run and rollback plans.
- **Next DevTools MCP**: diagnose routing/data‑fetch/bundle issues during dev.

**Outputs**: Updated `todo.md`, working feature, local tests green.
**Exit**: Core functionality complete; tests passing locally.

**Template**

```markdown
# Implementation Checklist

## Setup

- [ ] Create/extend components
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

## Batched Questions (if any)

- ...
```

---

### Phase 4 — **Verification & Validation** (`verification.md`)

**Goal**: Prove it works, is accessible, and performs.

**Activities (UI required)**:

- **Chrome DevTools MCP Manual QA**:
  - DOM semantics; Console (no errors); Network waterfall shape.
  - Device emulation (mobile/tablet/desktop).
  - Performance profiling (CPU/network throttling).
  - Lighthouse/a11y checks (labels, headings, contrast, focus).

- Cross‑browser smoke tests (where feasible).
- Validate edge cases & error paths; perf budgets; basic security checks.

**Use MCP here**

- **Chrome DevTools MCP**: all the above checks & artifacts capture.

**Outputs**: Checklists, metrics, issues, sign‑offs captured in `verification.md`.
**Exit**: Meets success criteria; no P0/P1 defects; sign‑offs done.

**Template**

```markdown
# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [x] No Console errors
- [x] Network requests match contract
- [ ] Performance warnings addressed (notes)

### DOM & Accessibility

- [x] Semantic HTML verified
- [x] ARIA attributes correct
- [x] Focus order logical & visible indicators
- [x] Keyboard-only flows succeed

### Performance (profiled)

- FCP: <value> s
- LCP: <value> s
- CLS: <value>
  Notes: ...

### Device Emulation

- [x] Mobile (≈375px)
- [x] Tablet (≈768px)
- [x] Desktop (≥1280px)

## Test Outcomes

- [x] Happy paths
- [x] Error handling
- [ ] Non‑critical perf issues (tracked as <ticket>)

## Known Issues

- [ ] <issue> (owner, priority)

## Sign‑off

- [ ] Engineering
- [ ] Design/PM
```

---

### Phase 5 — **Review & Merge**

**Activities**:

- Open PR referencing the task directory.
- Use **Conventional Commits** in PR title (`feat: ...`, `fix: ...`, etc.).
- Attach screenshots/clips for UI; link to `verification.md`.

**Use MCP here**

- **Atlassian MCP**: link PR to ticket; update status.
- **GitHub tool (if configured)**: surface checks, requested reviewers.

**Exit**: Approvals obtained; CI green; merged via squash/rebase per repo policy.

**PR Checklist** _(include in PR description)_

```
[ ] Links to task folder and ticket
[ ] Screenshots/clips (UI) + verification.md
[ ] Tests added/updated
[ ] A11y verified (keyboard, SR cues)
[ ] Perf checked (no regressions)
[ ] Docs/changelogs updated if needed
```

---

### Phase 6 — **Release & Deployment**

**Activities**:

- Roll out per plan; monitor metrics/logs; keep flag guardrails.
- Hotfix if needed; document in task folder.

**Use MCP here**

- **Supabase MCP**: apply DB changes to the correct **remote** environment; confirm backups/rollback steps recorded.
- Observability stack (dashboards/alerts) per service.

**Exit**: Stable at 100%; final notes added to task folder.

---

### Phase 7 — **Operate & Improve**

**Activities**:

- Monitor SLOs; triage incidents; capture learnings.
- File follow‑ups; schedule refactors/tech debt as tasks.

**Use MCP here**

- **Atlassian MCP**: create follow‑ups and post‑mortems; link evidence.

**Exit**: Learnings captured; backlog updated.

---

## 5) Frontend: Component & UX Standards

### Components

- **Use SHADCN UI via Shadcn MCP**; extend rather than rebuild.
- Search for existing patterns before introducing new ones.

### Mobile‑First & Progressive Enhancement

- Build for small screens first; enhance for larger screens.
- Core flows should not depend on non‑essential JS where reasonable.

### Accessibility (must‑haves)

- Full keyboard navigation; manage focus (trap in modals, restore on close).
- Visible focus via `:focus-visible`.
- Prefer semantic HTML; add ARIA only when necessary.
- Provide accessible names/labels; avoid color‑only cues.
- Hierarchical headings; per‑view titles.
- Toasts/validation use polite `aria-live`.

### Forms

- Inputs ≥16px font on mobile.
- Proper `type`, `inputmode`, `autocomplete`.
- Submit surfaces inline validation; focus first error.
- Keep submit enabled until request starts; show non‑blocking spinners.
- Permit paste; trim values; warn before navigating away with unsaved changes.
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
- Animate only `transform`/`opacity`; make animations interruptible.
- Test mobile, laptop, ultra‑wide; avoid accidental scrollbars.
- Respect safe areas with `env(safe-area-inset-*)`.

### Performance

- Minimize re‑renders; virtualize large lists.
- Prevent image‑induced CLS (reserve space).
- Target <500ms for common user‑visible mutations.

---

## 6) Back End & Data

### Supabase — **Remote Only**

- **Never** run local Supabase for this project.
- All migrations/seeds target the **remote** instance (staging/prod per plan).

**MCP‑first operations**

- Use **Supabase MCP** to:
  - Preview migrations (dry run), then apply to the _target remote_.
  - Seed only when required and idempotent.
  - Capture migration IDs and rollback steps in `verification.md`.

**Commands (illustrative)**

```bash
# Push migrations to remote (configure DB URL/token via env or MCP)
supabase db push --db-url $SUPABASE_DB_URL

# Seeds (remote; only if required and safe)
supabase db seed --db-url $SUPABASE_DB_URL
```

**Safety**

- Review migrations carefully; coordinate with maintainers.
- Document rollout/rollback in `verification.md`.
- Ensure backups prior to impactful schema changes.

---

## 7) Monorepos & Nested AGENTS.md

### When to Create Nested Files

Create `AGENTS.md` inside subprojects that have:

- Unique build/test commands
- Different frameworks/patterns
- Distinct security/deployment flows
- Library vs app concerns that justify tailored guidance

### Precedence Rules

1. The **closest** `AGENTS.md` to a file wins.
2. Nested docs **inherit** main rules; they may **add/override** as needed.

### Template for Nested Files

```markdown
# AGENTS.md — <Subproject Name>

> Inherits main AGENTS.md. Additions/overrides below.

## Overview

<Brief purpose and scope>

## Commands

- `npm run dev`
- `npm run build`
- `npm run test`

## Subproject-Specific Guidelines

- ...

## Links

- ...
```

**Example Monorepo Layout**

```
/
├── AGENTS.md
├── apps/
│   ├── web/        └── AGENTS.md
│   ├── mobile/     └── AGENTS.md
│   └── admin/      └── AGENTS.md
├── packages/
│   ├── ui/         └── AGENTS.md
│   ├── api-client/ └── AGENTS.md
│   └── database/   └── AGENTS.md
└── infrastructure/ └── AGENTS.md
```

---

## 8) MCP Tooling & Integrations (Catalog + Rules)

> Use MCP when it provides **repeatability, safety, or scale**. Do _not_ hardcode tokens; configure via env/secrets.

### MCP Inventory (examples reflect common setup)

- **Chrome DevTools MCP**
  _Use for_: Manual QA (console/network, device emulation, performance profiling, Lighthouse/a11y).
  _Phases_: 4.
  _Notes_: For auth‑protected pages, obtain a valid session token _out‑of‑band_. Never commit it.

- **Shadcn MCP**
  _Use for_: Discovering existing UI components, scaffolding variants, synchronizing tokens.
  _Phases_: 2, 3.
  _Rule_: Prefer SHADCN before building custom.

- **Next DevTools MCP**
  _Use for_: Next.js routing/data‑fetch debug, server/client boundary inspection, bundle hints.
  _Phases_: 2, 3.

- **Supabase MCP**
  _Use for_: Remote migrations/seeds; verifying schema drift; generating rollback plans.
  _Phases_: 2, 3, 6.
  _Rule_: **Remote only**; pass connection strings/tokens via secrets. Never in code.

- **Context7 MCP**
  _Use for_: Semantic search over internal knowledge (docs, ADRs, past tasks).
  _Phases_: 1.

- **DeepWiki MCP**
  _Use for_: External/domain research summaries (standards, RFCs).
  _Phases_: 1.

- **Atlassian MCP**
  _Use for_: Fetch/update ticket details, link PRs, move states during Review/Release/Operate.
  _Phases_: 1, 5, 7.

- **GitHub tool** (if available)
  _Use for_: PR metadata, checks, reviewers; linking evidence to task.
  _Phases_: 5.

**MCP Security Rules**

- All tokens via env/secret store (e.g., `SUPABASE_DB_URL`, `ATLASSIAN_API_TOKEN`).
- Rotate tokens regularly; expect expiry; verify before sessions.
- Do not log secrets in artifacts (`research.md`, `plan.md`, etc.).
- For auth QA, use short‑lived session cookies provided by a maintainer.

---

## 9) Git & Branching

- **Branch**: `task/<slug>-YYYYMMDD-HHMM`
- **Commits**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
- **PR**: Reference the task folder; include checklists and evidence (screens, clips, metrics).

---

## 10) Red Flags & Stop Signs

Escalate immediately if:

- No reusable pattern exists for a risky area → **request design/arch review**.
- Requirements ambiguous → **clarify in Phase 1** before coding.
- Scope too large → **split into multiple tasks**.
- Assumptions stack up → **document & validate with maintainer**.
- No verification plan → **define success criteria** first.
- Skipping **DevTools MCP** QA for UI → **not allowed**.
- Attempting **local** Supabase migrations/seeds → **not allowed**.
- Secrets appear in diffs or artifacts → **block PR** until removed.

---

## 11) Quick Reference Checklists

**Task Lifecycle**

```
[ ] Create task dir (UTC timestamp)
[ ] Requirements & analysis → research.md
[ ] Design/plan written → plan.md
[ ] Implementation executed → todo.md
[ ] Verification recorded → verification.md (DevTools MCP for UI)
[ ] Approvals & merge
[ ] Release & monitor; notes added
[ ] Post‑release learnings filed (tickets)
```

**UI/A11y Essentials**

```
[ ] Keyboard‑only flows succeed
[ ] Visible focus management
[ ] Semantic roles/labels
[ ] URL reflects state
[ ] Loading/empty/error states implemented
[ ] No CLS from media; images sized
```

**Perf Essentials**

```
[ ] No console errors/warnings
[ ] Critical interactions < 500ms
[ ] FCP/LCP reasonable; profiles attached
```

**Data & Migrations**

```
[ ] Remote Supabase only (via MCP)
[ ] Migration reviewed & coordinated
[ ] Rollback/backup plan noted
```

**Security & Privacy**

```
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

### A) Example Artifacts

Use the templates embedded in phases above; copy into your task files.

### B) Style Principles

- **DRY**: Reuse patterns/components.
- **KISS**: Prefer simple, obvious solutions.
- **YAGNI**: Build only what’s needed now.

### C) MCP Pre‑Flight (copy into `verification.md` when MCP is used)

```
[ ] Server reachable (version printed)
[ ] Session token valid (if required)
[ ] Secrets sourced via env (not logged)
[ ] Target environment confirmed (staging/prod)
```

---

**Last Updated**: 2025‑10‑28
**Version**: 5.0
