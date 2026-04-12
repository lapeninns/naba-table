---
task: ai-rule-doc-deletion-dry-run
timestamp_utc: 2026-04-12T17:34:33Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Plan

## Objective

Move the user-confirmed markdown files that govern or instruct AI behavior into `~/.Trash`, covering both the clear candidates and the previously ambiguous AI-workflow docs.

## Steps

1. Inventory exact `AGENTS.md` files.
2. Inventory design-system markdown files.
3. Identify other likely AI-rule docs by location/content (`.codex`, `CONTINUITY.md`, similar governance docs).
4. Return a dry-run summary with proposed deletion groups and note ambiguities requiring user confirmation before actual deletion.

## Verification

- Confirm no delete/move commands were run.
- Confirm each proposed file appears in the filesystem inventory.
