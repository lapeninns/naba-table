---
skill: continuity-ledger
version: 1.0
category: session-management
phases: [0, 1, 3, 7]
updated: 2025-12-22
---

# Continuity Ledger Skill

**Purpose**: Maintain session continuity across context compaction and long-running tasks through a structured ledger file.

**When to Use**:

- **Phase 0 (Initiation)** — Initialize for new sessions
- **Phase 1 (Requirements)** — Track requirements and constraints
- **Phase 3 (Implementation)** — Update progress and decisions
- **Phase 7 (Operate)** — Capture learnings and post-release notes

---

## Overview

The Continuity Ledger is a compaction-safe session briefing designed to survive context compaction in AI agents. Unlike ephemeral chat context, the ledger is a **persistent file** (`CONTINUITY.md`) that serves as the canonical source of truth for:

- Current goals and success criteria
- Constraints and assumptions
- Key decisions made
- Progress state (Done/Now/Next)
- Working set of files and commands

---

## How It Works

### At the Start of Every Assistant Turn

1. **Read** `CONTINUITY.md` from the workspace root
2. **Update** it to reflect the latest goal/constraints/decisions/state
3. **Proceed** with the work

### When to Update the Ledger

Update `CONTINUITY.md` whenever any of these change:

- Goal or success criteria
- Constraints or assumptions
- Key decisions
- Progress state (Done/Now/Next)
- Important tool outcomes
- Working set of files

### Formatting Guidelines

- Keep it **short and stable**: facts only, no transcripts
- Prefer **bullets** over prose
- Mark uncertainty as `UNCONFIRMED` (never guess)
- Update timestamps when changing content

---

## CONTINUITY.md Format

Use this exact structure (keep all headings even if empty):

```markdown
# Continuity Ledger

Last updated: <ISO-8601 timestamp>

## Goal (incl. success criteria)

- <Primary objective>
- <Success criteria 1>
- <Success criteria 2>

## Constraints/Assumptions

- <Constraint 1>
- <Assumption 1> (UNCONFIRMED)

## Key decisions

- <Decision 1>: <rationale>
- <Decision 2>: <rationale>

## State

- <Current state summary>

## Done

- <Completed item 1>
- <Completed item 2>

## Now

- <Currently working on>

## Next

- <Next step 1>
- <Next step 2>

## Open questions (UNCONFIRMED if needed)

- <Question 1>
- <Question 2> (UNCONFIRMED)

## Working set (files/ids/commands)

- <file1.ts>
- <file2.tsx>
- <command to run>
```

---

## Ledger vs. `functions.update_plan`

| Aspect          | `functions.update_plan`                          | `CONTINUITY.md`                           |
| --------------- | ------------------------------------------------ | ----------------------------------------- |
| **Purpose**     | Short-term execution scaffolding                 | Long-running continuity across compaction |
| **Scope**       | 3–7 step plan with pending/in_progress/completed | What/why/current state at intent level    |
| **Lifetime**    | Single work session                              | Entire task duration                      |
| **Granularity** | Micro-steps                                      | High-level progress                       |

### Keep Them Consistent

When the plan or state changes, update the ledger at the **intent/progress level** (not every micro-step). The ledger should reflect what you're doing and why, not the granular execution details.

---

## In Replies (Ledger Snapshot)

When responding, begin with a brief **Ledger Snapshot**:

```markdown
**Ledger Snapshot**

- **Goal**: <brief goal>
- **Now**: <what you're doing>
- **Next**: <upcoming steps>
- **Open**: <key questions if any>
```

Print the full ledger only when:

- It materially changes
- The user explicitly asks

---

## Handling Context Compaction

If you notice missing recall or a compaction/summary event:

1. **Refresh/Rebuild** the ledger from visible context
2. **Mark gaps** as `UNCONFIRMED`
3. **Ask up to 1–3 targeted questions** to fill gaps
4. **Continue** with the work

### Example Recovery Pattern

```markdown
## Open questions (UNCONFIRMED if needed)

- Was the database migration applied to staging? (UNCONFIRMED - pre-compaction decision)
- Which feature flag namespace is in use? (UNCONFIRMED)
```

---

## Complete Example

```markdown
# Continuity Ledger

Last updated: 2025-12-22T10:30:00Z

## Goal (incl. success criteria)

- Implement guest booking cancellation flow
- Success: Guest can cancel booking from My Bookings page
- Success: Confirmation email sent on cancellation
- Success: Ops dashboard reflects cancelled status

## Constraints/Assumptions

- Follow SDLC phases; no coding before requirements and plan are reviewed
- Everything is a task with `tasks/<slug>-YYYYMMDD-HHMM>/` artifacts
- Manual UI QA via Chrome DevTools MCP required for UI changes
- Guest auth via Supabase Auth (existing pattern)

## Key decisions

- Use soft delete (status change) not hard delete for audit trail
- Cancellation reason is optional (user research pending)
- Refund logic out of scope for this task

## State

- Phase 3 (Implementation) - Core cancellation API complete, UI in progress

## Done

- Created `DELETE /api/bookings/[id]/cancel` endpoint
- Added `cancelled_at` column via migration
- Updated BookingCard with cancel button (hidden until wired)

## Now

- Wiring cancel button to API in MyBookingsClient

## Next

- Add confirmation modal before cancel
- Implement email notification on cancel
- Manual QA via Chrome DevTools MCP
- Update verification.md with screenshots

## Open questions (UNCONFIRMED if needed)

- Should cancelled bookings be hidden or shown with strikethrough?

## Working set (files/ids/commands)

- src/app/api/bookings/[id]/cancel/route.ts
- src/app/guest/my-bookings/MyBookingsClient.tsx
- components/booking/OpsBookingCard.tsx
- supabase/migrations/20251222_add_cancelled_at.sql
- tasks/guest-cancel-booking-20251222-1000/
```

---

## Anti-Patterns

### ❌ Don't Do This

- **Don't treat it as a task list** — that's what `todo.md` is for
- **Don't include conversation transcripts** — facts only
- **Don't speculate** — use `UNCONFIRMED` instead
- **Don't skip updates** — stale ledgers defeat the purpose
- **Don't duplicate granular plan steps** — keep it high-level

### ✅ Do This Instead

- Keep entries concise and factual
- Update on meaningful state changes
- Use `UNCONFIRMED` liberally when uncertain
- Reference task folder for details
- Maintain working set for quick context

---

## Verification Checklist

```text
[ ] CONTINUITY.md exists in workspace root
[ ] All headings are present (even if empty)
[ ] Timestamp is current
[ ] Goal includes success criteria
[ ] State reflects actual progress
[ ] Working set lists active files
[ ] UNCONFIRMED marks all uncertainties
```
