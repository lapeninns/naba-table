# AGENTS.md

**Operating handbook for AI coding agents and human contributors**

> A concise, end‑to‑end process for delivering reliable software changes with the same structure every time.

---

## 1) Scope & Audience

- **Who**: AI coding agents, human engineers, reviewers, and maintainers working in this repository.
- **What**: The authoritative workflow, quality bars, file structure, and conventions for any change (feature, bug fix, refactor, experiment).
- **Why**: Consistency, traceability, and safe iteration—especially across monorepos and multiple subprojects.

---

## 2) Non‑Negotiables (Read First)

1. **Follow the phases in order** (no coding before research & plan).
2. **Everything is a Task** with its own time‑stamped directory and artifacts.
3. **Manual UI QA via Chrome DevTools (MCP) is mandatory** for any UI change.
4. **Supabase: remote only**—never run migrations or seeds against a local instance.
5. **Prefer existing patterns** (DRY/KISS/YAGNI). Use **SHADCN UI** before building custom components.
6. **Accessibility is required**, not optional (WCAG/WAI‑ARIA APG alignment).
7. **Document assumptions & deviations** from the plan, inside the task folder.

---

## 3) Task Structure & Naming

- **Directory**: `tasks/<slug>-YYYYMMDD-HHMM/`
  - Use a clear semantic **slug**: `user-auth-flow`, `payment-gateway-integration`, `fix-avatar-cropping`.
  - **Timestamp**: `YYYYMMDD-HHMM` in **UTC** (e.g., `20250110-1430` → 2025‑01‑10 14:30 UTC).

- **Required files** inside each task directory:

  ```
  tasks/<slug>-YYYYMMDD-HHMM/
  ├── research.md      # What exists, what to reuse, constraints, references
  ├── plan.md          # Objective, design, API, states, tests, rollout
  ├── todo.md          # Executable checklist (atomic steps)
  └── verification.md  # Manual QA, test outcomes, performance, sign-offs
  ```

**Example**
`tasks/user-authentication-flow-20250110-1430/`

---

## 4) End‑to‑End Workflow (Phases)

> Move through phases 0 → 6 without skipping. Use the **exit criteria** as gates.

### Phase 0 — **Task Setup**

**Inputs**: Ticket or problem statement.
**Activities**:

- Create `tasks/<slug>-YYYYMMDD-HHMM/` (UTC).
- Capture initial requirements + success criteria (brief).
  **Outputs**:
- Directory created.
- Success criteria drafted in `plan.md` (placeholder is fine).
  **Exit**:
- Task folder exists, with at least a stubbed `research.md` and `plan.md`.

---

### Phase 1 — **Research** (`research.md`)

**Goal**: Understand before building.
**Activities**:

- Search the codebase for existing patterns/utilities/components.
- Identify reuse opportunities and anti‑patterns to avoid.
- Review relevant external specs, RFCs, docs.
- Record constraints, open questions, and recommended approach.
  **Outputs** (`research.md`):
- Existing patterns/components to reuse.
- External references and links.
- Constraints (tech, performance, security, product).
- Open Q&A (resolved if possible).
- Rationale for a recommended direction.
  **Exit**:
- A reasoned recommendation exists; known constraints & risks are explicit.

**Suggested Template** (use in `research.md`)

```markdown
# Research: <Feature/Change Name>

## Existing Patterns & Reuse

- ...

## External Resources

- [Spec/Doc](url) – note why it matters

## Constraints & Risks

- ...

## Open Questions (and answers if resolved)

- Q: ...
  A: ...

## Recommended Direction (with rationale)

- ...
```

---

### Phase 2 — **Planning** (`plan.md`)

**Goal**: Turn research into an implementable blueprint.
**Activities**:

- Build mobile-first — design and develop for the smallest screens and core features first, then progressively enhance the layout, interactions, and visuals for larger screens. Responsive design ensures the site automatically adapts to different screen sizes.
- Design with existing patterns and components.
- Define data flow, API contracts, UI states, and error paths.
- Plan tests and rollout.
  **Outputs** (`plan.md`):
- **Objective** + **Success Criteria** (measurable).
- **Architecture** (diagrams optional), component breakdown, state mgmt.
- **API contracts** (request/response, error shapes).
- **UI/UX** flows (loading/empty/error/success).
- **Testing strategy** (unit/integration/E2E/accessibility).
- **Edge cases** and failure handling.
- **Rollout plan** (flags, gradual exposure, metrics).
  **Exit**:
- Reviewer can say “yes, build this” without more meetings.

**Suggested Template** (use in `plan.md`)

```markdown
# Implementation Plan: <Feature/Change Name>

## Objective

We will enable <user> to <goal> so that <outcome>.

## Success Criteria

- [ ] <metric or condition>
- [ ] <metric or condition>

## Architecture & Components

- <ComponentA>: role
- <ComponentB>: role
  State: <where/why> | Routing/URL state: <...>

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
- Monitoring: <metric/logs>
```

---

### Phase 3 — **Implementation** (`todo.md`)

**Goal**: Execute with momentum and traceability.
**Activities**:

- Break work into atomic, checkable steps.
- Work through them sequentially; batch questions in one block.
- Log deviations from plan and assumptions.
  **Outputs** (`todo.md`):
- A living checklist with progress.
  **Exit**:
- Core functionality complete; tests passing locally.

**Suggested Template** (use in `todo.md`)

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

### Phase 4 — **Verification** (`verification.md`)

**Goal**: Prove the change works, performs, and is accessible.
**Activities (all required for UI)**:

- **Chrome DevTools (MCP) Manual QA**:
  - Inspect DOM semantics, Console (no errors), Network waterfall.
  - Device emulation (mobile/tablet/desktop).
  - Performance profiling (CPU/network throttling).
  - Lighthouse/Accessibility checks (labels, headings, contrast, focus).

- Cross‑browser smoke (where feasible).
- Validate edge cases and error paths.
  **Outputs** (`verification.md`):
- Checklists, metrics, known issues, sign‑offs.
  **Exit**:
- Meets success criteria; no P0/P1 defects; sign‑offs captured.

**Suggested Template** (use in `verification.md`)

```markdown
# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [x] No Console errors
- [x] Network requests shaped per contract
- [ ] Performance warnings addressed (note if any)

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
- [ ] Non-critical performance issues (tracked as <ticket>)

## Known Issues

- [ ] <issue> (owner, priority)

## Sign-off

- [ ] Engineering
- [ ] Design/PM
```

---

### Phase 5 — **Review & Merge**

**Activities**:

- Open PR referencing the task directory.
- Use **Conventional Commits** in the PR title (e.g., `feat: <...>`, `fix: <...>`).
- Attach screenshots/clips for UI changes.
  **Exit**:
- Approvals obtained; CI green; PR merged via squash/rebase per repo policy.

**PR Checklist** (include in PR description)

```
[ ] Links to task folder and ticket
[ ] Screenshots/clips (UI)
[ ] Tests added/updated
[ ] A11y verified (keyboard, SR cues)
[ ] Perf checked (no regressions)
[ ] Docs/changelogs updated if needed
```

---

### Phase 6 — **Release & Post‑Release**

**Activities**:

- Gradual rollout per plan; monitor metrics/logs.
- Hotfix if needed; capture learnings in the task folder.
  **Exit**:
- Stable at 100%; task folder updated with final notes.

---

## 5) Tooling & Integrations

### MCP Server (Model Context Protocol)

Use MCP to:

- Navigate/inspect the codebase at scale.
- Retrieve docs/specs and prior art.
- Run **Chrome DevTools MCP** for Manual QA (UI).

**Chrome DevTools MCP Authentication**

- Obtain a **valid login session token for auth protected pages if required** (do not commit or hardcode).
- Tokens **expire**; verify before each session.
- **Do not proceed** with MCP‑based QA without a valid token.
- If operating interactively with a human maintainer, request the token explicitly and wait to receive it before testing.

---

## 6) Frontend: Component & UX Standards

### Components

- **Use SHADCN UI** when available; extend rather than rebuild.
- Search for existing patterns before introducing new ones.

### Mobile‑First & Progressive Enhancement

- Build for small screens first; enhance for desktop.
- Core flows must work without JS bells/whistles where reasonable.

### Accessibility (must‑haves)

- Full keyboard navigation; manage focus (trap in modals, restore on close).
- Visible focus via `:focus-visible`.
- Prefer semantic HTML; add ARIA only when necessary.
- Provide accessible names/labels, not color‑only cues.
- Hierarchical headings; proper titles per view.
- Toasts/validation should use polite `aria-live`.

### Forms

- Inputs ≥16px font on mobile (prevent zoom).
- Proper `type`, `inputmode`, and `autocomplete`.
- Allow submission to surface inline validation errors; focus the first error.
- Keep submit enabled until request starts; show non‑blocking spinners.
- Permit paste; trim values; warn before navigating away with unsaved changes.
- `Enter` submits single‑line inputs; `Ctrl/⌘+Enter` submits textareas.

### Navigation & State

- Reflect state in the **URL** (filters, tabs, pagination).
- Restore **scroll position** on back/forward.
- Use `<a>/<Link>` to support new‑tab and middle‑click.

### Touch & Targets

- Hit area ≥24px (mobile ≥44px). Expand via padding if visuals are smaller.
- `touch-action: manipulation` where appropriate.

### Motion & Layout

- Respect `prefers-reduced-motion`.
- Animate only `transform`/`opacity`; make animations interruptible.
- Test layouts on mobile, laptop, and ultra‑wide; avoid unwanted scrollbars.
- Respect safe areas via `env(safe-area-inset-*)`.

### Performance

- Minimize re‑renders; virtualize large lists.
- Prevent image‑induced CLS (reserve space).
- Target sub‑500ms user‑visible mutations for common paths.

---

## 7) Back End & Data

### Supabase — **Remote Only**

- **Never** run local Supabase for this project.
- All migrations/seeds target the **remote** instance (staging/prod per plan).

**Commands**

```bash
# Migrations (remote)
supabase db push

# Seeds (remote; only if required and safe)
supabase db seed
```

**Safety**

- Review migrations carefully; coordinate with the team.
- Document changes and rollout/rollback in `verification.md`.
- Backups/restore plan for impactful schema changes.
- Run seeds only when necessary and idempotent.

---

## 8) Monorepos & Nested AGENTS.md

### When to Create Nested Files

Create `AGENTS.md` **inside subprojects** that have:

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

## 9) Git & Branching

- **Branch name**: `task/<slug>-YYYYMMDD-HHMM`
- **Commits**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
- **PR**: Reference the task folder; include checklists and evidence (screens, clips, metrics).

---

## 10) Red Flags & Stop Signs

Stop and escalate when you see:

- No reusable pattern exists for a risky area → **request design/arch review**.
- Requirements are ambiguous → **clarify before coding**.
- Scope is too large → **split into multiple tasks**.
- Many assumptions accumulating → **document & validate with a maintainer**.
- No verification plan → **define success criteria** first.
- Skipping **DevTools MCP** QA for UI → **not allowed**.
- Attempting **local** Supabase migrations/seeds → **not allowed**.

---

## 11) Quick Reference Checklists

**Task Lifecycle**

```
[ ] Create task dir (UTC timestamp)
[ ] Research complete → research.md
[ ] Plan written → plan.md
[ ] Implementation executed → todo.md
[ ] Verification recorded → verification.md
[ ] UI changes: DevTools (MCP) QA done
[ ] Approvals & merge
[ ] Rollout & monitor, notes added
```

**UI/A11y Essentials**

```
[ ] Keyboard-only flows succeed
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
[ ] FCP/LCP reasonable; profile attached
```

**Data & Migrations**

```
[ ] Remote Supabase only
[ ] Migration reviewed & coordinated
[ ] Rollback/backup plan noted
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

- See the templates embedded in phases above; copy into your task files.

### B) Style Principles

- **DRY**: Reuse patterns/components.
- **KISS**: Prefer simple, obvious solutions.
- **YAGNI**: Build only what’s needed now.

---

**Last Updated**: 2025‑10‑12
**Version**: 4.0

---
