# Implementation Plan - Responsive Layout Adjustments

## Objective

Improve responsive spacing and layout for `BookingListClient` and `ReceiptClient` to ensure a consistent and polished experience across mobile (375px), tablet (768px), and desktop (1280px) viewports.

## Success Criteria

- [ ] `BookingListClient` hero section scales appropriately (compact on mobile, spacious on desktop).
- [ ] `BookingListClient` grid and cards use responsive padding/gaps (`gap-4` mobile -> `gap-6` desktop).
- [ ] `ReceiptClient` stat cards grid adapts gracefully.
- [ ] Touch targets remain accessible (>=44px).
- [ ] No visual regressions or broken layouts.

## Architecture & Components

### BookingListClient

- **Hero**: Adjust `py` and `px` classes.
- **Main Container**: Adjust `px` and `py`.
- **Tabs**: Ensure trigger size is touch-friendly.
- **BookingCard**: Make padding responsive (`p-4` -> `p-6`).

### ReceiptClient

- **Stat Cards**: Update grid gap to use responsive Tailwind classes instead of static CSS variable if appropriate, or mix them.
- **Action Buttons**: Ensure proper spacing in mobile/desktop views.

## Data Flow & API Contracts

No changes to data flow.

## UI/UX States

- Mobile: Tighter spacing, full-width elements where appropriate.
- Desktop: Generous whitespace, balanced grids.

## Testing Strategy

- Manual verification via code review (since I can't see the screen).
- Ensure class names are valid Tailwind utilities.
- Verify logical progression of breakpoints (`sm`, `md`, `lg`).

## Rollout

- Direct update to client components.
