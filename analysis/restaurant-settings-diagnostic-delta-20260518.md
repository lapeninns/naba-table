# Diagnostic Delta Report: May 2026 Diagnostic vs. Current Codebase State

This delta document reconciles the findings of the **May 2026 Restaurant Settings Diagnostic** against the current codebase state as of **May 18, 2026**.

---

## 1. Resolved Findings (Major Progress)

Since the original diagnostic, significant structural and layout-focused refactors have been completed successfully:

### Finding 1: No Setup Index Route $\rightarrow$ **RESOLVED**

- **Original Issue**: The settings route group lacked a unified landing path or dashboard overview, forcing new operators to navigate six sibling tabs directly without context.
- **Current State**: `src/app/app/(app)/settings/restaurant/page.tsx` now loads `RestaurantSetupOverview.tsx`, which serves as a highly engaging setup overview. It presents three concrete setup steps (Public profile, Booking availability, Seating capacity) and renders a visual progress indicator ("Readiness Ring") derived from database states.

### Finding 2: Flat Peer Sidebar Subnavigation $\rightarrow$ **RESOLVED**

- **Original Issue**: Sidebar subnav exposed all tabs as peer items, showing no visual prioritization or setup flow.
- **Current State**: Navigation definitions in `useRestaurantSettingsNav.ts` are now cleanly divided into logical groups: **Required Setup** (Profile, Availability, Tables), **Operational Management** (Menu, Team), and **Integrations** (Google Business Profile). The layout also incorporates visual drift badges for GBP alignment.

### Finding 3: Booking Slug Buried in Advanced Profile $\rightarrow$ **RESOLVED**

- **Original Issue**: The guest booking link (slug config) sat at the bottom of the long profile page under "Advanced".
- **Current State**: Extracted into its own dedicated section inside `profileSections.ts` and `RestaurantProfileSection.tsx`, giving it prominent visual visibility.

### Finding 4: Massive Discovery Monolith (2,126 lines) $\rightarrow$ **RESOLVED**

- **Original Issue**: `RestaurantBusinessContextSection.tsx` owned all business details, links, categories, service areas, attributes, and items, making it a huge maintenance risk.
- **Current State**: Decomposed! The panel-level editing cards have been extracted into separate files under `discovery/panels/` (e.g., `AttributesPanel.tsx`, `LinksPanel.tsx`, `CategoriesPanel.tsx`), reducing `RestaurantBusinessContextSection.tsx` to just 249 lines.

### Finding 5: Focused Shell Layout and Header $\rightarrow$ **RESOLVED**

- **Original Issue**: The layout lacked a clear escape path or focused "zen mode" for core settings configuration.
- **Current State**: `RestaurantSettingsFocusedShell.tsx` and `RestaurantSettingsSidebar.tsx` now isolate settings, providing a prominent `X` escape hatch returning operators safely to the dashboard, and ensuring unsaved form edits are intercepted.

---

## 2. Still Open Redesign Targets (The Active Backlog)

The remaining open issues represent the next logical wave of UX and architectural refinement:

### Target 1: Discovery Details Still Embedded in Profile Page

- **Friction**: Even though the discovery panels have been split into standalone files, they are still mounted inside the `ProfileSectionBody.tsx` container under `ProfileLoadedView.tsx`. Profile loading is still heavy, and optional discovery inputs compete with mandatory branding fields.
- **Backlog Action**: Promote Discovery Details to its own route `/settings/restaurant/discovery`, separate from Profile.

### Target 2: Monolithic Availability Scheduling Stack

- **Friction**: `AvailabilityScheduleManager.tsx` (874 lines) and `OperatingHoursSection.tsx` (832 lines) remain massive files. They mix schedule states, opening times, meal windows, and custom holiday date exceptions.
- **Backlog Action**: Decompose these two massive containers into smaller, workspace-scoped cards (`WeeklyScheduleCard`, `DateOverridesCard`, `BookingRulesCard`).

### Target 3: Technical Terminology & Operator Outcome Labels

- **Friction**: Labels like "Reservation interval", "Default reservation duration", and "Occasions" still exist in the forms, forcing managers to translate engineering vocabulary to standard restaurant vocabulary.
- **Backlog Action**: Perform an front-end copy pass to standardize outcome-focused naming: slot spacing, default table time, and booking types.

### Target 4: Inconsistent Save Boundaries

- **Friction**: Profile uses a global floating save action (`UnifiedActionBar`), Discovery uses per-family saves, and Availability uses one multi-domain save handler. Operators are uncertain about when data is safely committed.
- **Backlog Action**: Standardize visual status indicators (e.g. "Saves weekly schedule only") under save button groups.

### Target 5: External Giants Boundary Integration

- **Friction**: Menu sheets (`MenuItemSheet.tsx` $\sim$ 1K lines) and table clients (`TableInventoryClient.tsx` $\sim$ 1.2K lines) remain huge files containing deep data models, table filtering, zone management, and modal sheets.
- **Backlog Action**: Draft focused redesign briefs at the feature boundary to implement quick-edit drawers (for prices and item availability) and simplified table layout slots.
