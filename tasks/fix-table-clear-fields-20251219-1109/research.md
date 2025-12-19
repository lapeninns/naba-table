---
task: fix-table-clear-fields
timestamp_utc: 2025-12-19T11:10:33Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Restore null clearing for table position/notes

## Requirements

- Functional: Table updates must allow clearing stored `position` and `notes` by sending `null` when fields are cleared.
- Non-functional: Keep changes minimal and consistent with existing create payload behavior.

## Existing Patterns & Reuse

- Table create payload normalizes `position` and `notes` with `?? null` in `src/services/ops/tables.ts`.
- Table update payload currently forwards fields verbatim, which omits `undefined` values in JSON.

## External Resources

- None.

## Constraints & Risks

- Update payload is a partial type; forcing `undefined` to `null` could clear fields if callers rely on omission.
- Current UI form sets `notes` to `null` when cleared and keeps `position` from the existing table, so change aligns with form intent.

## Open Questions (owner, due)

- Q: Any other caller relies on omitting `position`/`notes` to avoid updates?
  A: No other call sites found (only `TableInventoryClient`).

## Recommended Direction (with rationale)

- Coalesce `position` and `notes` to `null` in update payload to preserve clearing behavior and match create payload semantics.
