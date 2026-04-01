---
name: nabatable-fullstack-delivery
description: Use when delivering Nabatable full-stack changes across Next.js UI, hooks, routes, server logic, and tests, especially when deciding between RED-first feature work, verification-first regression work, and test-only changes.
allowed-tools:
  - Read
  - Edit
  - Write
  - Glob
  - Grep
  - Bash(rg:*)
  - Bash(pnpm test:*)
  - Bash(pnpm lint:*)
  - Bash(pnpm typecheck:*)
  - Bash(npx vitest run:*)
when_to_use: Use when implementing or tightening Nabatable features/fixes that span UI, hooks, routes, or backend logic. Examples: "ship this UI + API change", "fix a regression cleanly", "add proof for an existing behavior", "update the canonical path and the tests".
paths:
  - src/**
  - server/**
  - hooks/**
  - lib/**
  - libs/**
  - reserve/**
  - tests/**
---

# Nabatable Fullstack Delivery

This skill turns the repo's repeated review feedback into a clearer delivery workflow.

## Goal

Ship Nabatable changes through the canonical implementation path with the right level of test and verification rigor for the kind of change being made.

## First Decision: What Kind Of Task Is This?

- **Net-new feature or behavior**:
  - Prefer RED-first targeted tests before implementation.
- **Regression fix where current behavior must be inspected first**:
  - Verification-first is acceptable.
  - Confirm the current implementation and failure mode, then add or strengthen guard tests.
  - Document the deviation from pure RED-first in the task artifacts.
- **Test-only or proof-only task**:
  - No browser verification is required if only tests changed.
  - State that clearly in `verification.md`.

## Implementation Rules

- Update the canonical path, not a duplicate path.
- Reuse the real production component/client path in tests instead of helper replicas whenever possible.
- Keep shared state and business rules centralized.
- Prefer existing repo patterns over new abstractions.

## Testing Rules

- Use focused tests that exercise the real behavior under the actual component or route path.
- If you cannot write RED-first for a regression because the first step is confirming existing production behavior, say so explicitly.
- Passing tests alone are not enough if the task requires proof of an interactive or cross-surface state transition.

## Verification Rules

- Use `$nabatable-ui-proof` for UI changes that need browser evidence.
- For non-UI changes, record the exact automated proof path used.
- If a verification requirement could not be completed, capture the blocker and the compensating evidence instead of silently downgrading the claim.

## Done Criteria

- The change landed in the canonical path.
- The chosen delivery mode matches the task type and is documented honestly.
- Tests and verification prove the requested behavior rather than a nearby approximation.
