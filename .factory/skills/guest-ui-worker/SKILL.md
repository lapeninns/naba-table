---
name: guest-ui-worker
description: Build and refine guest-facing layouts, primitives, and page experiences in the unified guest design system.
---

# Guest UI Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for guest-facing design-system work that primarily changes:

- guest layouts and shells
- guest primitives and shared UI patterns
- public discovery pages
- guest booking/detail/receipt presentation
- guest portal pages and forms

Use this skill when the feature’s main job is to make guest surfaces feel warm, clear, trustworthy, and consistent.

## Required Skills

- `Frontend Aesthetics` — invoke before making UI decisions so the implementation avoids generic/admin-like styling and keeps the guest system distinctive and coherent.
- `agent-browser` — invoke for manual verification of changed guest surfaces on the live browser surface or mocked portal surface.

## Work Procedure

1. Read `mission.md`, mission `AGENTS.md`, `.factory/library/guest-design-system.md`, `.factory/library/architecture.md`, and `.factory/library/guest-routes.md`.
2. Read the actual files you plan to edit. Identify whether the page is still using a competing shell or bespoke guest pattern.
3. Before implementing, invoke `Frontend Aesthetics` and note the page-level design choices you will preserve or improve.
4. Write tests first (RED):
   - component tests in `tests/components/**`
   - guest route/view-model or page tests in `tests/guest/**`
   - Playwright guest-flow tests when visible behavior or route flow changes
   - Run a targeted RED command and confirm failure before implementation
5. Implement by extending or adopting canonical guest primitives first. Do not add another guest shell, typography system, or one-off auth/account pattern unless the feature explicitly updates the canonical primitive layer.
6. Run targeted tests until green, then run:
   - `npx vitest run --maxWorkers=9`
   - `pnpm typecheck`
   - `pnpm lint`
7. Invoke `agent-browser` for manual verification:
   - use `http://localhost:3000` for public/auth/booking surfaces
   - use mocked portal validation for `/guest/dashboard`, `/guest/bookings`, and `/guest/profile` when real authenticated bootstrap is unavailable
8. Capture concrete interactive checks:
   - which route was opened
   - what changed visually
   - what CTA/tab/form/status behavior was observed
9. Commit only your feature changes in the isolated worktree.

## Example Handoff

```json
{
  "salientSummary": "Unified the guest dashboard and bookings pages onto the canonical guest shell and shared booking-card/status patterns. Added mocked fixture coverage for dashboard/bookings coherence, then verified the updated portal surfaces in a mocked browser flow.",
  "whatWasImplemented": "Migrated dashboard and bookings portal surfaces to the shared guest shell, aligned page spacing and card treatment, normalized the upcoming/past tab model, and reused shared guest status/empty/error patterns so the two pages now behave as one portal experience.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "npx vitest run tests/guest/guest-view-models.test.ts tests/guest/guest-bookings-params.test.ts --reporter=verbose",
        "exitCode": 1,
        "observation": "RED confirmed before implementation because the bookings tab normalization assertion and dashboard fixture-coherence assertion failed."
      },
      {
        "command": "npx vitest run tests/guest/guest-view-models.test.ts tests/guest/guest-bookings-params.test.ts --reporter=verbose",
        "exitCode": 0,
        "observation": "Targeted guest portal tests passed after implementation."
      },
      {
        "command": "npx vitest run --maxWorkers=9",
        "exitCode": 0,
        "observation": "Full Vitest suite passed."
      },
      {
        "command": "pnpm typecheck",
        "exitCode": 0,
        "observation": "TypeScript clean for the updated guest portal files."
      },
      {
        "command": "pnpm lint",
        "exitCode": 0,
        "observation": "Lint passed."
      }
    ],
    "interactiveChecks": [
      {
        "action": "Opened mocked /guest/dashboard and /guest/bookings flows in the browser to compare the same fixture across both pages.",
        "observed": "The featured booking on the dashboard matched the bookings-list card for restaurant, date/time, and lifecycle status."
      },
      {
        "action": "Switched the bookings page between upcoming and past tabs with invalid/legacy query values.",
        "observed": "Unsupported tab values normalized to the supported upcoming/past model without a broken state."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "tests/guest/guest-bookings-params.test.ts",
        "cases": [
          {
            "name": "normalizes legacy history to past",
            "verifies": "The bookings tab query stays within the supported upcoming/past model."
          },
          {
            "name": "falls back invalid tab to upcoming",
            "verifies": "Broken or unknown query state does not strand the guest."
          }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- The feature would require a new competing guest shell or route model that conflicts with the mission charter.
- A guest-facing assertion depends on canonical route behavior that is not yet implemented by a routing feature.
- Mocked portal validation is insufficient for a required behavior and no stable fixture can be created within scope.
- The only way to complete the feature would be to modify schema, credentials, or off-limits ops/admin areas.
