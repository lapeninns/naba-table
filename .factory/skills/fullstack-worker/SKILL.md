---
name: fullstack-worker
description: Full-stack worker for Next.js UI components, API routes, hooks, and tests
---

# Fullstack Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

For features that involve Next.js frontend components (React/Tailwind/shadcn), API route handlers, TanStack React Query hooks, service layer functions, and associated tests. This covers both UI redesign work and backend API endpoint creation.

## Required Skills

- `agent-browser` — MUST invoke for manual verification of any UI changes. After implementing, open the dev harness or authenticated page and verify visually.

## Work Procedure

1. **Read the feature description** carefully. Read `AGENTS.md` for conventions and boundaries. Read `.factory/library/architecture.md` for component hierarchy and data flow.

2. **Understand existing code**: Read the files you'll modify. Understand imports, patterns, and adjacent code. Check `types/emailDelivery.ts` for type definitions. Check `components/ui/` for available UI primitives.

3. **Write tests first (RED)**:
   - For utility functions: Write Vitest tests in `tests/lib/email-delivery/` or `tests/components/`
   - For components: Write @testing-library/react tests in `tests/components/`
   - Tests must fail before implementation (TDD)
   - Run tests with `npx vitest run --reporter=verbose` to confirm they fail

4. **Implement (GREEN)**:
   - Follow existing patterns exactly (see AGENTS.md conventions)
   - Use existing UI components from `components/ui/` (Table, Tabs, Badge, Button, Card, Select, ToggleGroup, etc.)
   - Use `cn()` for class merging, never raw string concatenation for conditional classes
   - Use `import type { ... }` for type-only imports
   - Keep the dev harness (`OpsEmailDeliveryDevHarness`) working
   - For API routes: follow the auth guard pattern from existing routes

5. **Make tests pass (GREEN)**:
   - Run `npx vitest run --reporter=verbose` — all tests must pass
   - Fix any failures

6. **Run validators**:
   - `pnpm typecheck` — must pass with zero errors in changed files
   - `pnpm lint` — must pass

7. **Manual verification with agent-browser**:
   - Open the dev harness: `agent-browser open http://localhost:3000/dev/ops-email-delivery`
   - OR authenticate and open: `agent-browser open http://app.localhost:3000/auth/signin` → login → navigate to `/email-delivery`
   - Take screenshots of the implemented feature
   - Verify all interactive elements work (clicks, filters, toggles)
   - Close browser when done: `agent-browser close`

8. **Commit**: Stage and commit with a descriptive message.

## Example Handoff

```json
{
  "salientSummary": "Replaced card-based delivery log with a sortable data table using shadcn Table components. Added Status and Sent At column sorting with visual indicators. Ran `npx vitest run` (12 passing), `pnpm typecheck` (clean), verified table rendering and sort toggling via agent-browser at /dev/ops-email-delivery.",
  "whatWasImplemented": "New OpsEmailDeliveryTable component with sortable columns (Status, Sent At), expandable row detail showing event timeline and message ID. Updated OpsEmailDeliveryClient to render table instead of card list. Added tests for sort logic and table rendering.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "npx vitest run --reporter=verbose",
        "exitCode": 0,
        "observation": "12 tests passing including 4 new table tests"
      },
      {
        "command": "pnpm typecheck",
        "exitCode": 0,
        "observation": "No errors in email-delivery files"
      },
      { "command": "pnpm lint", "exitCode": 0, "observation": "Clean" }
    ],
    "interactiveChecks": [
      {
        "action": "Opened /dev/ops-email-delivery, verified table renders with columns: Status, Subject, Recipient, Email Type, Booking Ref, Customer, Sent At",
        "observed": "All columns visible, data populated from mock, screenshot captured"
      },
      {
        "action": "Clicked Sent At column header twice to toggle sort",
        "observed": "Rows reordered ascending then descending, arrow indicator toggled direction"
      },
      {
        "action": "Clicked a row to expand detail",
        "observed": "Event timeline appeared below row with status badges and timestamps"
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "tests/components/OpsEmailDeliveryTable.test.tsx",
        "cases": [
          {
            "name": "renders table with correct columns",
            "verifies": "All expected column headers are present"
          },
          {
            "name": "sorts by Sent At on header click",
            "verifies": "Rows reorder on column header click"
          },
          {
            "name": "expands row on click",
            "verifies": "Detail section appears with event timeline"
          },
          {
            "name": "shows empty state when no data",
            "verifies": "Empty message shown for zero results"
          }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Feature depends on a component or API that doesn't exist yet and isn't part of this feature's scope
- Existing tests break due to changes in shared types and the fix is non-trivial
- The dev server won't start or has errors unrelated to this feature
- Requirements are ambiguous (e.g., unclear what columns to show, what data to sort by)
- Auth/session issues prevent manual verification
