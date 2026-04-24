# Nabatable SDLC Operating System

This directory is Nabatable's repo-native operating system for software delivery.

It is designed for both humans and coding agents. The root `AGENTS.md` stays short and global; this directory holds the deeper process that should not live in the root policy file.

## Purpose

Use this operating system to answer four recurring questions:

1. What process weight does this task require?
2. What artifacts should be created before and during implementation?
3. How should work move from plan to code to verification?
4. Which specialist role should handle which part of the job?

## System layout

- `risk-tier-workflow.md` — low/medium/high process model
- `task-harness.md` — task-folder structure and artifact expectations
- `verification.md` — verification matrix and evidence rules
- `subagents.md` — how Nabatable should use planner, implementer, reviewer, and UI QA roles

## Core operating rules

- Root `AGENTS.md` is the global entrypoint. Read it first.
- Use the smallest process that still protects quality.
- Medium/high-risk work should live in `tasks/<slug>-YYYYMMDD-HHMM>/`.
- Verification is part of delivery, not a follow-up.
- Use repo scripts and tests as the source of truth for validation.
- Prefer direct first-class changes in canonical codepaths.

## Nabatable delivery model

### Low risk

Use for narrow bug fixes, copy changes, or isolated refactors.

Default flow:

1. Inspect the relevant files.
2. Make the smallest correct change.
3. Run focused validation.
4. Summarize what changed and what was verified.

Task folders are optional.

### Medium risk

Use for new features, new components, route changes, API changes, or meaningful UX work.

Default flow:

1. Create a task folder.
2. Write `research.md` and `plan.md` before coding.
3. Implement in small verified slices.
4. Record verification in `verification.md`.

### High risk

Use for auth changes, database changes, cross-cutting refactors, billing, data integrity, or multi-surface workflow rewrites.

Default flow:

1. Create a task folder.
2. Complete research and planning before coding.
3. Explicitly document rollout, failure modes, and verification coverage.
4. Capture evidence in `artifacts/`.
5. Require maintainer-quality review before merge.

## How to use this directory

- Start in `risk-tier-workflow.md` to choose the correct path.
- Use `task-harness.md` when a task folder is required.
- Use `verification.md` before claiming work is done.
- Use `subagents.md` when the work should be split by role.
