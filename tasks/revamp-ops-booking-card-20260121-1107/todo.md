# Implementation Checklist

## Phase 3: Implementation

- [x] Consolidate display logic into a memoized `meta` object using native `Date`.
- [x] Implement "Status Rail" border-l-4 with dynamic colors.
- [x] Create standardized `InfoTile` sub-component.
- [x] Implement 4-column responsive grid layout.
- [x] Add Notes highlighting (amber tint).
- [x] Refactor header (Avatar, Bold Name, Party Size/Time).
- [x] Move secondary actions to `DropdownMenu` (meatball menu).
- [x] Anchor primary action button (Seat/Finish) in bottom right.
- [ ] Refine Accessibility:
  - [ ] Add `aria-label` to meatball menu trigger.
  - [ ] Ensure proper heading hierarchy (`h3`).
  - [ ] Verify focus rings on buttons.
- [ ] Remove any leftover `luxon` imports or logic.

## Phase 4: Verification

- [ ] Run `lsp_diagnostics` on `OpsBookingCard.tsx`.
- [ ] Perform manual QA with Chrome DevTools MCP.
- [ ] Attach Lighthouse/Axe report to `artifacts/`.
- [ ] Final sign-off.

## Notes

- Already implemented core structure in previous turn; focus now is on refinement, a11y, and compliance.
