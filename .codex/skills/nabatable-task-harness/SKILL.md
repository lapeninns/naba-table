---
name: nabatable-task-harness
description: Use when starting or steering work in Nabatable and you need to follow the repo's AGENTS.md rhythm: task folder setup, AGENTS discovery, continuity updates, evidence capture, and scoped implementation planning.
allowed-tools:
  - Read
  - Edit
  - Write
  - Glob
  - Grep
  - Bash(date:*)
  - Bash(find:*)
  - Bash(rg:*)
  - Bash(mkdir:*)
when_to_use: Use when beginning, rescoping, or closing work in Nabatable. Examples: "start this task properly", "set up the task folder", "align this work with AGENTS.md", "update continuity and verification artifacts", "make sure this change follows the repo harness".
paths:
  - AGENTS.md
  - CONTINUITY.md
  - tasks/**
  - .codex/**
---

# Nabatable Task Harness

Use this skill to make the repo's AGENTS process real, not ceremonial.

## Goal

Set up and maintain the minimum durable artifacts that let a Nabatable task survive context switches, review, and follow-on verification.

## Core Workflow

1. Read the root `AGENTS.md` and any closer nested `AGENTS.md` files for the touched area.
2. Create or update a task folder under `tasks/<slug>-YYYYMMDD-HHMM>/` using UTC.
3. Keep `research.md`, `plan.md`, `todo.md`, and `verification.md` aligned with the current state of the work.
4. Update `CONTINUITY.md` whenever the goal, constraints, decisions, or working set changes materially.
5. Keep assumptions and blockers explicit in artifacts instead of leaving them in chat history.

## Nabatable-Specific Rules

- Root `AGENTS.md` is the policy source of truth.
- Repo-local `.codex/skills/` should be preferred when the task matches them; use global skills as complements.
- If the task changes guest-facing public or booking UI, record `/GUEST_FACING_DESIGN_SYSTEM.md` in the task artifacts as the visual source of truth and treat it as higher priority than legacy guest styling notes.
- The task folder should record the real verification path taken, including when a required browser or auth flow needed a fallback.
- Keep the working set small and relevant. Do not turn task artifacts into transcripts.

## Done Criteria

- A task folder exists with meaningful current-state contents.
- `CONTINUITY.md` reflects the current goal, state, and next step.
- The plan and verification notes are specific enough for another agent to continue the work cleanly.
