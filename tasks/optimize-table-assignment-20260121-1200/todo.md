# Implementation Checklist

## Core

- [ ] Modify `SelectableTableCard.tsx` to accept and use parsed time props.
- [ ] Modify `TableAssignmentPanel.tsx`:
  - [ ] Fix O(N^2) filter.
  - [ ] Pre-parse times.
  - [ ] Pass parsed times to cards.

## Notes

- Ensure fallback to string parsing in `SelectableTableCard` works for backward compatibility.
