# Implementation Checklist: Guest Portal UX/UI Revamp

## Phase 1: Research & Inventory

- [ ] Audit GuestLayout component
- [ ] Audit GuestDashboardClient component
- [ ] Audit GuestProfileClient component
- [ ] Audit booking-related components
- [ ] Check available Shadcn components in registry
- [ ] Document current color/theme tokens
- [ ] Identify reusable patterns

## Phase 2: Design Direction

- [ ] Define typography system (following frontend-aesthetics)
- [ ] Define color palette for guest theme
- [ ] Define spacing/layout system
- [ ] Define motion/animation approach
- [ ] Create component upgrade list

## Phase 3: Implementation

### Shared/Layout

- [ ] Update GuestLayout with refined styling
- [ ] Create/update shared guest components

### Dashboard (`/guest/dashboard`)

- [ ] Revamp layout structure
- [ ] Update booking cards
- [ ] Add loading/empty/error states
- [ ] A11y verification

### Profile (`/guest/profile`)

- [ ] Revamp form layout
- [ ] Update input styling
- [ ] Add loading/empty/error states
- [ ] A11y verification

### Bookings List (`/guest/bookings`)

- [ ] Revamp tabs UI
- [ ] Update booking list cards
- [ ] Add pagination styling
- [ ] Add loading/empty/error states
- [ ] A11y verification

### Booking Detail (`/guest/bookings/[id]`)

- [ ] Revamp detail layout
- [ ] Update action buttons
- [ ] Add loading/error states
- [ ] A11y verification

### Receipt (`/guest/bookings/[id]/receipt`)

- [ ] Revamp receipt layout
- [ ] Print-friendly styling
- [ ] A11y verification

## Phase 4: Verification

- [ ] Chrome DevTools MCP - Dashboard
- [ ] Chrome DevTools MCP - Profile
- [ ] Chrome DevTools MCP - Bookings
- [ ] Chrome DevTools MCP - Booking Detail
- [ ] Chrome DevTools MCP - Receipt
- [ ] Cross-browser smoke test
- [ ] Mobile device testing
- [ ] Lighthouse performance audit
- [ ] Axe accessibility audit

## Notes

- Assumptions: Using existing data flow, UI-only changes
- Deviations: None yet

## Batched Questions

- None yet
