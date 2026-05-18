# Redesign Brief: Availability Schedule Stack

## Problem

The availability module is powered by massive, monolithic components: `AvailabilityScheduleManager.tsx` (874 lines) and `OperatingHoursSection.tsx` (832 lines) mix concerns including weekly opening/closing times, daily meal window slot managers, custom holidays overrides, and booking types.

Furthermore, the interface relies on engineering-heavy terminology rather than restaurant-operations language (e.g., _"Reservation interval"_, _"Default reservation duration"_, _"Lifecycle grace period"_, and _"Occasions"_). This makes configuration feel technical and increases mistake rates when managers change holiday hours.

## Proposed IA

1. **Decomposition**: Break the monoliths down into focused sub-components under `src/components/features/restaurant-settings/availability/`:
   - `WeeklyScheduleCard.tsx`: Weekly days open/closed toggles and meal hours.
   - `BookingRulesCard.tsx`: Controls for pacing, table duration, and buffer constraints.
   - `DateOverridesCard.tsx`: Bank holidays, special operational days, and exceptions.
2. **Tabbed Switcher Integration**: Fully wire these cards into the `AvailabilityWorkspaceNav` tabs, transitioning from dynamic inline render blocks to dedicated sub-workspace mounts.
3. **Operator outcome Copy Pass**: Change form input labels dynamically in the front-end with no backend schema impacts:
   - `Reservation interval` $\rightarrow$ `Booking slot spacing`
   - `Default reservation duration` $\rightarrow$ `Default table time`
   - `Lifecycle grace period` $\rightarrow$ `Late-arrival grace period`
   - `Occasions` $\rightarrow$ `Booking types`

## Non-Goals

- No changes to the Supabase capacity, rules, or schedule table constraints.
- No changes to the validation schema middleware in Next.js api endpoints.

## Files Touched

- `src/components/features/restaurant-settings/AvailabilityScheduleManager.tsx` (decompose)
- `src/components/features/restaurant-settings/OperatingHoursSection.tsx` (decompose)
- `src/components/features/restaurant-settings/AvailabilityOccasionsEditor.tsx` (update labels and split)
- `src/components/features/restaurant-settings/availability/BookingRulesCard.tsx` (refine inputs)
- `src/components/features/restaurant-settings/availability/ScheduleWorkspace.tsx` (incorporate decomposed files)

## Risks

- **Validation Splitting**: The single save action currently validates the entire workspace. Splitting the files requires careful prop drilling or form-context sharing to prevent submitting invalid hours on unmounted forms.
- **Deep Hash Redirection**: Alias route hooks like `/settings/restaurant/occasions` must still align properly with the active tab workspace hash (`#booking-occasions`) to prevent loading state jumps.
