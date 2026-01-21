# Implementation Plan

## Objective

Update `OpsBookingCard` to improve mobile space efficiency and ensure full content visibility when expanded.

## Success Criteria

- [ ] Mobile: Collapsed state shows Summary + Actions. Expanded shows all Details.
- [ ] Text: No truncation on Phone, Email, Notes, Name.
- [ ] Desktop: Unchanged visual layout (always expanded).

## Changes

1. **Text Styles**:
   - Phone: Remove `whitespace-nowrap overflow-hidden text-ellipsis`. Add `break-words`.
   - Notes: Remove `line-clamp-3`. Add `break-words`.
   - Name: Ensure `break-words` (already present, check line-height).

2. **Mobile Layout**:
   - Header: Reduce vertical padding slightly on mobile if needed.
   - Footer: Ensure flex wrapping for small screens.
   - Actions: Verify accessibility of "Details" and "Menu".

3. **Refactoring**:
   - Keep `Collapsible` structure.
   - Ensure `CollapsibleContent` is hidden on mobile when closed.

## Verification

- Code review of class names.
- Logical check of responsive variants (`sm:`).
