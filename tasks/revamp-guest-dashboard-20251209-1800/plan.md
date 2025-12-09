---
task: revamp-guest-dashboard
timestamp_utc: 2025-12-09-1800
owner: antigravity
---

# Implementation Plan: Revamp Guest Dashboard

## Objective

Revamp the guest dashboard (`/guest/dashboard`) to strictly adhere to the `DesignSystem.md` principles (Midnight Majesty / Airbnb-esque), focusing on "great logic" and "great design".

## Research & Design System Analysis

- **Theme**: Clean, slate-based typography (Inter), soft shadows, high functionality.
- **Key Components**:
  - **Search Pill**: Airbnb-style horizontal bar with "Where", "Date", "Time", "Who".
  - **Metric Tile**: clean white card, icon in circle, value + label + detail.
  - **Typography**: `.heading-xl`, `.heading-lg`, `.text-body`.
  - **Shadows**: `--shadow-float`, `--shadow-card`.

## Components to Implement

Location: `src/guest/routes/dashboard/components/` (New directory to keep it localized or `src/components/design-system/guest` if broader reuse intended, but let's stick to dashboard specific or shared guest primitives).

1.  **GuestDesignTokens**: Ensure CSS variables from `DesignSystem.md` are available.
2.  **GuestSearchBar**: The Airbnb-style pill.
3.  **GuestMetricTile**: For stats (Total visits, Upcoming, Favorites).
4.  **GuestActionCard**: For quick actions (New Booking, History, etc.) - styled like MetricTile but interactive.
5.  **FeaturedBookingCard**: A premium card for the next visit, using `DesignSystem` styles (cleaner than current gradient).

## Step-by-Step Implementation

1.  **Styles**: Add `DesignSystem` specific variables to `src/app/globals.css` (or `guest-dashboard.css`).
2.  **Create Components**:
    - `src/guest/routes/dashboard/components/DashboardPrimitives.tsx` (MetricTile, ActionCard).
    - `src/guest/routes/dashboard/components/DashboardSearch.tsx` (Search Pill).
3.  **Refactor Dashboard**:
    - Replace `HighlightsRow` with `MetricTile` grid.
    - Replace `QuickActionCard` with new `GuestActionCard`.
    - Replace `FeaturedBooking` with new design.
    - Insert `DashboardSearch` at the top (Hero section).
4.  **Verify**: Check visually (if possible) or code-review against standard.

## Logic Enhancements

- Ensure "Search" actually redirects to search page with params? (Maybe just links for now as per current dashboard).
- "Great logic": Ensure empty states are handled gracefully (DesignSystem has `GuestEmpty` concepts?).
