# Research: Adjust OpsBookingCard UI

## Requirements

1. **Mobile UI**: Compact collapsed summary (<=640px).
   - Keep: Name, party size, time, status, urgency, primary action.
   - Hide: InfoTiles (by default).
2. **No Truncation**: Remove `truncate`, `ellipsis`, `line-clamp` on Name, Email, Notes.
   - Use `break-words` / `break-all`.
3. **Desktop**: Preserve high-density layout (always expanded).

## Current State Analysis

- File: `components/dashboard/OpsBookingCard.tsx`
- Component uses `Collapsible` from `components/ui/collapsible`.
- Current Desktop Behavior: `CollapsibleContent` forced visible via `sm:block`. Trigger hidden `sm:hidden`.
- Current Mobile Behavior: Collapsible works. Footer (Actions) always visible.
- Issues:
  - Phone number uses `text-ellipsis`.
  - Email uses `break-all` (good).
  - Notes uses `line-clamp-3`.
  - Header padding might be too loose for "compact".
  - Need to verify Primary Action visibility and alignment.

## Recommended Direction

- Remove `line-clamp` and `text-ellipsis` classes.
- Adjust Header padding for mobile.
- Ensure Footer buttons wrap or scale gracefully.
- Verify `break-words` on Name.
