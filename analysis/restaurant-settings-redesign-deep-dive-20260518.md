# Architectural Deep-Dive Blueprint: Restaurant Settings Redesign

This blueprint provides the technical architecture, state machines, and code-level refactoring designs for the four P0/P1 target modules of the Nabatable restaurant settings redesign backlog.

---

## 1. Save Boundaries & Tab-Drift Alerts (P0)

### Current Implementation & Mechanics

The Profile editor employs a hybrid transactional model. As seen in [RestaurantProfileSection.tsx](file:///Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/RestaurantProfileSection.tsx), a central hook `useProfileDraftState` tracks dirty state for branding, contact details, and booking settings. The [UnifiedActionBar.tsx](file:///Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/profile/UnifiedActionBar.tsx) handles floating save indicators.

When the operator clicks "Save all", the system executes:

```typescript
const handleSaveAllProfileForms = useCallback(() => {
  emitSaveAllClicked(dirtyFormSections);
  dirtyFormSections.forEach((section) => {
    const form = document.getElementById(section.formId);
    if (form instanceof HTMLFormElement) {
      form.requestSubmit(); // Triggers native form validate & submit
    }
  });
}, [dirtyFormSections, emitSaveAllClicked]);
```

### The Architectural Problem

- **Save Boundary Mismatch**: The profile subforms use HTML element forms, whereas Discovery details use inline component-level mutations that write directly to query caches, and Availability uses a colossal single handler.
- **Cognitive Friction**: Operators are left uncertain which buttons commit what exact transaction scope, and navigating away before manual submission is a major source of data loss.

### Proposed Refactored Architecture

1. **Dynamic Tab Badging**: Update [RestaurantSettingsSidebar.tsx](file:///Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/RestaurantSettingsSidebar.tsx) to listen to the registry hook `useOpsUnsavedChanges()`. If any route in the subnav contains dirty inputs, render an orange alert indicator next to the item:

```tsx
// Proposed code inside RestaurantSettingsSidebar
import { useUnsavedChangesRegistry } from '@/contexts/ops-unsaved-changes';

export function SidebarNavItem({ route }) {
  const registry = useUnsavedChangesRegistry();
  const isDirty = registry.hasUnsavedChangesForRoute(route.pathname);

  return (
    <Link href={route.pathname} className="relative flex items-center justify-between">
      <span>{route.label}</span>
      {isDirty && (
        <span
          className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"
          role="status"
          aria-label="Unsaved changes"
        />
      )}
    </Link>
  );
}
```

2. **Standardized Save Scope Messaging**: Wrap save action footers inside a reusable helper function `formatSaveScopeMessage` located in [compactSettingsClasses.ts](file:///Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/shared/compactSettingsClasses.ts).
   - Profile: _"Saves local brand and contact details only. Sync with Google remains optional."_
   - Availability: _"Saves weekly schedule and override hours only."_

---

## 2. Discovery Promotion to Standalone Route (P0)

### Current Implementation & Mechanics

The six core public-facing context panels (dining categories, amenities, search attributes, online URLs, and service areas) are loaded as components inside [RestaurantBusinessContextSection.tsx](file:///Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx) under the `/settings/restaurant/profile` path.

### The Architectural Problem

Having these six optional, highly complex panels mounted on the profile page leads to heavy DOM footprints, layout-reflow shifts, and complicated chunking. It forces the first-time setup checklist to share real estate with optional content fields.

```
[Current Flat Shell]
Profile Page (Mandatory Details)
 └── Brand Identity Form
 └── Public Contact Info
 └── [Embedded] 6 Discovery Detail Panels (Categories, Areas, Attributes, etc.)

[Proposed Promoted Shell]
Profile Page (Mandatory Details Only)
 └── Brand Identity Form
 └── Public Contact Info
Discovery Page (Standalone /settings/restaurant/discovery)
 └── 6 Discovery Detail Panels
```

### Proposed Refactored Architecture

1. **Route promotion**: Promote discovery to a dedicated Next.js directory structure:
   - Page Route: `src/app/app/(app)/settings/restaurant/discovery/page.tsx`
   - Client Coordinator: Switch in `OpsRestaurantSettingsClient.tsx` matching `view === 'discovery'`.
2. **Deep Hash Routing**: Update Google Business Profile comparative sync components. When comparing drifted fields, if the drift belongs to categories or attributes, direct links must correctly append hash coordinates matching the new path:
   ```typescript
   // GBP drift comparer link builder
   const getDriftEditHref = (fieldKey: string) => {
     if (fieldKey.startsWith('discovery.')) {
       const panelHash = fieldKey.split('.')[1]; // e.g., 'attributes'
       return `/settings/restaurant/discovery#${panelHash}`;
     }
     return `/settings/restaurant/profile#${fieldKey}`;
   };
   ```

---

## 3. Availability Schedule Stack Decomposition (P1)

### Current Implementation & Mechanics

As analyzed, [AvailabilityScheduleManager.tsx](file:///Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/AvailabilityScheduleManager.tsx) is a heavy 874-line monolith. It handles:

- Weekly operating hours (`useOpsOperatingHours`)
- Nested service periods (`useOpsServicePeriods`)
- Dynamic booking occasions (`useOpsOccasions`)
- Turn durations based on cover size (`useOpsTurnBands`)
- A singular `handleSave` handler executing multiple concurrent database mutation workflows.

### Proposed Refactored Architecture

1. **Monolithic Decomposition**: Break this file into clean, domain-specific visual card boundaries under the `src/components/features/restaurant-settings/availability/` directory:

```
AvailabilityScheduleManager.tsx (Coordinator Hub)
  ├── WeeklyScheduleCard.tsx (Controls opensAt/closesAt per weekday)
  ├── ServiceWindowsCard.tsx (Manages lunch/dinner meal period boundaries)
  ├── DateOverridesCard.tsx  (Manages custom exception dates and holiday blocks)
  └── BookingRulesCard.tsx   (Controls spacing, dining turn times, grace limits)
```

2. **Term Harmonization Copy Pass**: Replace engineering jargon with outcome-oriented terms within form inputs:
   - `Reservation interval` $\rightarrow$ **`Booking slot spacing`**
   - `Default reservation duration` $\rightarrow$ **`Default table time`**
   - `Lifecycle grace period` $\rightarrow$ **`Late-arrival grace period`**
   - `Occasions` $\rightarrow$ **`Booking types`**

---

## 4. Google Business Profile & Dual-Sync (P1)

### Current Implementation & Mechanics

The Google Business Profile (GBP) integration connects via OAuth to sync address details, meal times, and public business categories. Synchronization and drift review are performed inside [dual-sync/DualSyncShell.tsx](file:///Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/dual-sync/DualSyncShell.tsx).

### The Architectural Problem

- **Unclear Optionality**: First-time operators believe they cannot complete setup without full GBP sync setup.
- **Transient Alerts**: Drift warnings are fired as fleeting toast notifications that are easily missed, leading to silent synchronization failures when credentials expire.

### Proposed Refactored Architecture

1. **Google Connection Optionality Card**: Mount a sleek informational card at the top of the Google Business Profile view:

   ```tsx
   <Card className="border-sky-500/20 bg-sky-500/5">
     <CardHeader className="py-3">
       <CardTitle className="text-sm font-medium text-sky-700 dark:text-sky-400">
         Google integration is 100% optional
       </CardTitle>
       <CardDescription className="text-xs">
         Connecting your Google Business Profile is designed to import address details and hours
         quickly. If you prefer, you can skip this step and enter details manually in Nabatable.
       </CardDescription>
     </CardHeader>
   </Card>
   ```

2. **Persistent Error Banner**: Mount a sticky `PersistentGbpErrorAlert` card at the top of the Dual Sync workspace if OAuth tokens expire, prompting instant recovery.
3. **Drift-Only Filter Row Toggle**: Implement a client-side filter toggle `showDriftOnly` default to `true`. This hides aligned rows and presents only fields requiring attention.
