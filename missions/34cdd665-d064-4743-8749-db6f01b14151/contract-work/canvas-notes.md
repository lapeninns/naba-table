# Canvas Notes

Source: worker analysis `canvas interaction assertions`

Key takeaways:

- The hero canvas remains the primary occupancy surface and must stay keyboard focusable.
- Keyboard pan/zoom/reset behavior must remain intact.
- Pointer drag may pan only from valid canvas space and must not trigger accidental selection.
- Table clicks toggle selection only; they must never launch booking flows.
- Search, zone, date, and time controls must continue to determine which tables are visible.
- Empty-search handling, legend/status semantics, and summary counts must align with `useFloorPlanTables`.
- Reserved, seated, loading, and out-of-service semantics must remain unchanged.
