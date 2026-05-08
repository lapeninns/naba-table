# Restaurant Settings Full Diagnostic

Captured: 2026-05-06  
Scope: shipped app-host restaurant settings routes under `/settings/restaurant/*`  
Baseline reviewed: `docs/restaurant-settings-route-inventory-20260506-1944.md`

## Summary

The restaurant settings area is not primarily suffering from missing features. The stronger problem is structure: setup-critical jobs, returning-admin maintenance, Google reconciliation, and advanced metadata are all presented as peer work. The route shell is now consistent and the six shipped views are well-covered by component tests, but the product still asks operators to infer what matters first.

The most important implementation direction is to introduce a setup/readiness model above the existing route cluster, then move optional or provider-shaped work behind progressive disclosure. This keeps the current capabilities while making the first-run path much smaller: public profile, booking availability, seating capacity, and then optional menu/team/Google enrichment.

## Executive Digest

- Severity count: 2 Critical, 4 High, 5 Medium, 3 Low.
- The shipped child routes are `profile`, `google-business-profile`, `availability`, `menu`, `tables`, and `team`; there is no `src/app/app/(app)/settings/restaurant/page.tsx` index route.
- The nav presents all six settings as equal siblings, with no readiness state or setup grouping.
- Profile is the highest-friction route because it contains public identity, contact/location, manager alerts, discovery metadata, Google status, and booking slug work.
- Discovery details are the largest single UX and code hotspot: `RestaurantBusinessContextSection.tsx` is 2,126 lines and manages six data families in one component.
- Availability is dense but mostly necessarily so; its issue is terminology and save confidence, not feature placement alone.
- Menu and Tables are operationally useful but still expose advanced classification and metadata earlier than a quick edit workflow needs.
- Team is comparatively clear and should mostly be preserved as the low-complexity model.
- This sprint should focus on route entry/readiness, labels, optionality copy, and save-state clarity.
- Next sprint should split discovery/advanced metadata and introduce setup versus maintenance IA.

## Route Truth

The route map is source-defined, not inferred from the inventory. `src/components/features/restaurant-settings/types.ts:3` defines exactly six views: `profile`, `google-business-profile`, `availability`, `menu`, `tables`, and `team`. `src/components/features/restaurant-settings/routes.ts:10` orders those six views and provides titles/descriptions.

Each child page is a thin handoff into the shared client:

| External app-host path                         | Internal page                                                               | View                      |
| ---------------------------------------------- | --------------------------------------------------------------------------- | ------------------------- |
| `/settings/restaurant/profile`                 | `src/app/app/(app)/settings/restaurant/profile/page.tsx:10`                 | `profile`                 |
| `/settings/restaurant/google-business-profile` | `src/app/app/(app)/settings/restaurant/google-business-profile/page.tsx:13` | `google-business-profile` |
| `/settings/restaurant/availability`            | `src/app/app/(app)/settings/restaurant/availability/page.tsx:11`            | `availability`            |
| `/settings/restaurant/menu`                    | `src/app/app/(app)/settings/restaurant/menu/page.tsx:11`                    | `menu`                    |
| `/settings/restaurant/tables`                  | `src/app/app/(app)/settings/restaurant/tables/page.tsx:11`                  | `tables`                  |
| `/settings/restaurant/team`                    | `src/app/app/(app)/settings/restaurant/team/page.tsx:10`                    | `team`                    |

The app-host proxy rewrites app-host page paths to `/app/*` and requires auth before rendering protected restaurant pages (`src/proxy.ts:270`). Root-host `/app/*` redirects to the app subdomain outside single-host mode (`src/proxy.ts:301`). Links are generated through `opsHref`, so a canonical `/settings/restaurant/profile` target becomes `/app/settings/restaurant/profile` in hrefs (`lib/url/opsHref.ts:27`). The page shell normalizes both forms when deciding the active nav item (`src/components/features/restaurant-settings/RestaurantSettingsPageShell.tsx:42`).

The layout protects the route cluster and redirects unauthenticated users to sign-in with `/app/settings/restaurant/profile` as the fallback redirected-from target (`src/app/app/(app)/settings/restaurant/layout.tsx:11`). There is no implemented default index page in `src/app/app/(app)/settings/restaurant/`; only six child `page.tsx` files exist.

## Severity Snapshot

| Severity | Count | Product meaning                                                  |
| -------- | ----: | ---------------------------------------------------------------- |
| Critical |     2 | Setup clarity and completion risk                                |
| High     |     4 | Material task slowdown or repeated operator mistakes             |
| Medium   |     5 | Friction, ambiguity, or maintainability risk with workable paths |
| Low      |     3 | Polish, readability, and prioritization improvements             |

## Critical Findings

### 1. No first-class setup entry point exists for the restaurant settings cluster

Impact: Operators do not get a guided answer to "what must I finish before this restaurant is ready?" They land on a peer route rather than an explicit setup overview, which makes six sections feel equally urgent.

Evidence: the route folder contains only child pages for `availability`, `google-business-profile`, `menu`, `profile`, `tables`, and `team`; there is no `src/app/app/(app)/settings/restaurant/page.tsx`. The nav similarly renders six sibling links from `RESTAURANT_SETTINGS_NAV_ITEMS` with no route-level readiness state (`src/components/features/restaurant-settings/RestaurantSettingsSubnav.tsx:176`). The baseline inventory also identifies the distributed setup path as critical because bookability spans Profile, Availability, Tables, and booking URL settings (`docs/restaurant-settings-route-inventory-20260506-1944.md:1535`).

Why now: the underlying route shell is already standardized, so an index/setup overview can be added without rewriting each feature view.

### 2. Profile remains the overloaded default mental model for unrelated setup jobs

Impact: The first settings route asks admins to interpret public identity, contact/location, internal alerts, optional discovery metadata, Google status, and the booking slug in one flow. This increases abandonment risk before the restaurant is bookable.

Evidence: `RestaurantProfileSection` renders cards for Brand and identity, Contact and location, Manager notifications, Discovery details, and Advanced (`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:428`). Discovery details embed `RestaurantBusinessContextSection` directly into Profile (`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:483`). The booking slug lives under an `Advanced` card even though it is core to the public booking URL (`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:497`). The baseline describes the same critical mismatch: core public setup, internal alerts, Google state, discovery metadata, and booking URL controls are mixed together (`docs/restaurant-settings-route-inventory-20260506-1944.md:1521`).

Why now: recent work already moved booking rules to Availability and gave Profile stable anchors, so the next step can be IA and copy rather than rebuilding the form system.

## High Findings

### 3. Discovery details are still too prominent for a default Profile load

Impact: Optional provider/discovery metadata can make the operator think the setup requires category codes, amenities, service areas, attributes, links, and service items before launch.

Evidence: the embedded discovery component owns six families of state and dirty tracking (`src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx:338`). It saves each family separately, including `businessDetails`, `links`, `categories`, `serviceAreas`, `attributes`, and `serviceItems` (`src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx:670`). The baseline calls out the same UX issue: Discovery Details asks admins to think about accessibility, payments, offerings, highlights, service options, category codes, online links, and service areas all in one place (`docs/restaurant-settings-route-inventory-20260506-1944.md:893`).

Recommendation: collapse discovery by default this sprint; next sprint, move it to a dedicated Public discovery details route or advanced sub-workspace.

### 4. Save boundaries are improved but still inconsistent across routes

Impact: Operators can still hesitate because Profile has section-level saves plus a sticky "Save all", Availability has one multi-domain "Save configuration", and Discovery uses family-level saves. The model is defensible technically, but the UI does not yet explain the boundary consistently.

Evidence: Profile submits multiple dirty subforms from a sticky save bar (`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:390`). Availability validates and saves hours, services, occasions, and turn bands in one handler, including partial-save warning paths (`src/components/features/restaurant-settings/AvailabilityScheduleManager.tsx:391`). Discovery exposes separate `Save profile basics`, `Save links`, `Save categories`, `Save service areas`, `Save attributes`, and `Save service items` flows through the same large component (`src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx:964`, `src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx:1135`, `src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx:1364`). The baseline flags repeated save actions as a medium issue (`docs/restaurant-settings-route-inventory-20260506-1944.md:1623`), but code evidence makes it a High because three save models coexist in the same route cluster.

Recommendation: keep the underlying save contracts, but standardize visible labels and status text: "Saved just now", "Unsaved in this section", and "This save updates X only".

### 5. Google is not clearly positioned as optional, required, or an accelerator

Impact: Operators may read Google connection and verification state as a prerequisite for setup instead of a sync/reconciliation accelerator.

Evidence: Profile includes a top action to "Manage Google connection" (`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:89`). The Google route includes connection, refresh, link, disconnect, location picker, and related-settings links (`src/components/features/restaurant-settings/google-business-profile/GoogleBusinessProfileSection.tsx:66`). The shared dispatcher also mounts the dual-sync shell only for `google-business-profile`, with sections spanning profile, operating hours, service periods, business context, and food menus (`src/components/features/restaurant-settings/OpsRestaurantSettingsClient.tsx:119`). The prior inventory ranks unclear Google optionality as High (`docs/restaurant-settings-route-inventory-20260506-1944.md:1565`).

Recommendation: add one sentence in the route shell and Profile related panel: "Google is optional; use it to import or compare public details faster."

### 6. Menu supports rich operations but lacks a first-class quick-edit path

Impact: Common edits such as price, sold-out/active status, and availability require entering full item sheets that also own metadata, modifiers, nutrition/allergen/enrichment fields, and import identifiers.

Evidence: the Menu route toggles between Food and Drinks through query state (`src/components/features/menu/OpsMenuManagementClient.tsx:16`). Food and drinks panels expose search/filter/import/new flows and open full sheets (`src/components/features/menu/FoodMenuManagementPanel.tsx:54`, `src/components/features/menu/DrinkMenuManagementPanel.tsx:53`). The sheets are large: `MenuItemSheet.tsx` is 994 lines and `DrinkItemSheet.tsx` is 1,072 lines. The baseline calls out menu editor overload as High because price, availability, description, allergens, nutrition, modifiers, import metadata, and scoring fields can appear in the same editing workflow (`docs/restaurant-settings-route-inventory-20260506-1944.md:1579`).

Recommendation: keep the full sheets, but add a quick edit drawer or inline row action for price/status/availability before advanced metadata.

## Medium Findings

### 7. Availability uses a correct but technical editing model

Impact: The route likely works for power users, but terms like service windows, booking occasions, turn bands, grace period, and interval force interpretation.

Evidence: Availability combines booking rules, weekly schedule, date overrides, booking occasions, and turn bands (`src/components/features/restaurant-settings/AvailabilityOccasionsCommandCenter.tsx:152`; `src/components/features/restaurant-settings/AvailabilityScheduleManager.tsx:764`). The save footer says one save persists weekly hours, service windows, date overrides, and booking occasions with turn times (`src/components/features/restaurant-settings/AvailabilityScheduleManager.tsx:836`). The baseline recommends renaming system-oriented labels such as `Reservation interval`, `Default reservation duration`, `Lifecycle grace period`, and `Occasions` (`docs/restaurant-settings-route-inventory-20260506-1944.md:1438`).

Recommendation: preserve the single command center, but relabel around operator outcomes: booking slot spacing, default table time, exceptions, and booking types.

### 8. Tables mixes setup capacity with advanced table classification

Impact: First-run table creation can feel heavier than "create capacity" because the form includes zone, category, seating type, mobility, status, active state, party-size range, section, and notes.

Evidence: `TableForm` controls zone, category, seating type, mobility, status, and active state before submission (`src/components/features/tables/TableInventoryClient.tsx:80`). The route also owns table queries, fallback zone queries, filters, keyboard shortcuts, table mutations, zone mutations, and summary cards in one 1,233-line client (`src/components/features/tables/TableInventoryClient.tsx:390`). The baseline recommends first-run table creation require only table number, capacity, party-size limits, active state, and optional zone (`docs/restaurant-settings-route-inventory-20260506-1944.md:1609`).

Recommendation: add first-run simplified table creation while keeping advanced fields behind "More table details".

### 9. The nav hierarchy does not distinguish setup, operations, and integrations

Impact: Returning admins can scan all routes, but new admins have no visual route grouping. Google, Menu, and Team appear as equal priorities to Profile, Availability, and Tables.

Evidence: `RESTAURANT_SETTINGS_NAV_ITEMS` orders six siblings and `RestaurantSettingsSubnav` renders them as a flat horizontal nav (`src/components/features/restaurant-settings/routes.ts:49`; `src/components/features/restaurant-settings/RestaurantSettingsSubnav.tsx:176`). The baseline identifies this as a critical source of heaviness because all routes appear equally important (`docs/restaurant-settings-route-inventory-20260506-1944.md:908`).

Recommendation: add a setup overview first, then group route links by Required setup, Operations, and Integrations/advanced.

### 10. Component hotspots raise regression risk for future IA work

Impact: Large route components make targeted UX changes harder to reason about and test. The risk is not current breakage; it is implementation drag and regression probability during the next restructuring pass.

Evidence: line counts from current sources show `RestaurantBusinessContextSection.tsx` at 2,126 lines, `RestaurantDetailsForm.tsx` at 2,023, `TableInventoryClient.tsx` at 1,233, `DrinkItemSheet.tsx` at 1,072, and `MenuItemSheet.tsx` at 994. These files mix data mapping, dirty tracking, validation, mutation orchestration, and dense UI composition.

Recommendation: decompose only along user-visible boundaries: discovery family editors, table form/model, table/zone mutations, and menu quick-edit versus full-edit flows.

### 11. Runtime proof is still separate from component-level confidence

Impact: The tests are useful, but product prioritization should not treat component tests as proof that the shipped route is usable in an authenticated browser session.

Evidence: route and shell tests assert every page hands off to `OpsRestaurantSettingsClient` and every nav href is present (`tests/components/RestaurantSettingsRoutePages.test.tsx:65`; `tests/components/RestaurantSettingsShell.test.tsx:190`). Component tests cover Profile, GBP, Availability, Menu, Tables, and Team states. This diagnostic did not run browser QA because it changed documentation only.

Recommendation: when implementation starts, every UI change needs shipped-route browser proof on `http://app.localhost:3000/settings/restaurant/<view>`, with any auth block stated plainly.

## Low Findings

### 12. Team is the clearest route and should remain mostly unchanged

Impact: This is a positive constraint. Team should not inherit the heavier command-center treatment used elsewhere.

Evidence: `OpsTeamManagementClient` is 51 lines and delegates to `TeamInviteForm` and `TeamInvitesTable` (`src/components/features/team/OpsTeamManagementClient.tsx:11`). The form uses email, role, and one submit action (`src/components/features/team/TeamInviteForm.tsx:48`). The invitation table has a simple status filter and empty message (`src/components/features/team/TeamInvitesTable.tsx:52`).

Recommendation: polish empty-state copy only; do not add readiness cards unless there is a real operator decision to support.

### 13. Summary cards should express readiness, not just counts

Impact: Counts can become visual weight if they do not tell the operator whether the setup is usable.

Evidence: `TableInventoryClient` derives summary cards for total tables, seats, active tables, inactive tables, and zones (`src/components/features/tables/TableInventoryClient.tsx:540`). The baseline warns that summary counts can become clutter if they do not express readiness (`docs/restaurant-settings-route-inventory-20260506-1944.md:1653`).

Recommendation: convert summaries to readiness statements, for example "Ready for bookings: 12 active tables, 48 covers".

### 14. Some labels still read as implementation vocabulary

Impact: Low individually, but cumulative label friction makes the settings area feel more technical than the jobs require.

Evidence: the baseline replacement list includes `Occasions` -> `Booking types`, `Reservation interval` -> `Booking slot spacing`, `Google Review URL` -> `Guest review link`, and `Provider metadata` -> `Import metadata` (`docs/restaurant-settings-route-inventory-20260506-1944.md:1438`). Code still contains corresponding labels in Availability and Profile subforms (`components/ops/restaurants/RestaurantDetailsForm.tsx:974`; `components/ops/restaurants/RestaurantDetailsForm.tsx:680`).

Recommendation: change labels opportunistically in the quick-win sprint, with no backend contract changes.

## Route-by-Route Notes

| Route                   | Current job clarity                                             | Main risk                                     | Priority |
| ----------------------- | --------------------------------------------------------------- | --------------------------------------------- | -------- |
| Profile                 | Mixed: public profile, internal alerts, discovery, booking slug | Overloaded default setup surface              | Critical |
| Google Business Profile | Clear connection workflow, unclear product optionality          | Operators may treat Google as required        | High     |
| Availability            | Strong workflow consolidation, dense terminology                | Hesitation before save                        | Medium   |
| Menu                    | Good catalogue separation, heavy full-edit sheets               | Slow day-to-day edits                         | High     |
| Tables                  | Operationally complete, dense first-run creation                | Capacity setup feels more complex than needed | Medium   |
| Team                    | Clear invite/access workflow                                    | Minor empty-state polish                      | Low      |

## Code-Level Observations

The best current architecture choice is the standardized route shell. Thin route pages, `OpsRestaurantSettingsClient`, shared nav metadata, and shell tests reduce routing drift. `tests/components/RestaurantSettingsShell.test.tsx:190` specifically checks route metadata and nav items stay in sync, and `tests/components/RestaurantSettingsRoutePages.test.tsx:65` checks each page remains a metadata-plus-view handoff.

The main maintainability risk is component mass around high-change UX areas. The largest files correspond to the places most likely to be restructured: discovery, profile forms, tables, and menu sheets. Refactors should not be generic "split big files" work. They should follow the product boundaries in this diagnostic: Public profile, Public discovery details, Booking rules/schedule, Menu quick edit, Table setup, and Team access.

React Query SWR handling is better in Menu than in some older settings code: `FoodMenuManagementPanel` wraps stale table states with `StaleBoundary` (`src/components/features/menu/FoodMenuManagementPanel.tsx:182`). Preserve that pattern when adding quick-edit flows.

## Prioritized Action Plan

### Quick Wins This Sprint

1. Add a `/settings/restaurant` setup overview or redirect strategy. Minimum viable version: a three-step readiness panel for Public profile, Booking availability, and Seating capacity.
2. Move or relabel booking slug from Profile Advanced to a core "Booking page URL" section.
3. Rename high-friction labels with no backend changes: Manager alerts, Booking slot spacing, Default table time, Booking types, Guest review link, Map link.
4. Collapse Profile Discovery details by default and add explicit copy that it is optional for richer public discovery and Google reconciliation.
5. Add save-boundary text to every section-level save: "Saves this section only" or "Saves the full availability workflow".
6. Add Google optionality copy on Profile and Google Business Profile.
7. Add first-run empty states for Tables and Menu that state the first useful action.

### Structural Refactors Next Sprint

1. Create a dedicated Public discovery details route or advanced workspace for business context families.
2. Split `RestaurantBusinessContextSection` into family-level editors with shared save/status primitives.
3. Add Menu quick edit for price, active/sold-out, and availability before opening the full sheet.
4. Split Table Inventory into table list, zone manager, table form, and mutation/model helpers.
5. Add route-level setup analytics: time to public profile complete, time to booking ready, route backtracking, unsaved exits, and advanced-section opens before core completion.
6. Rework nav grouping into Required setup, Operations, and Integrations/advanced once the setup overview exists.

## Appendix: Validation Checklist

- Route files verified from `src/app/app/(app)/settings/restaurant/**`: yes.
- Shared route metadata verified from `src/components/features/restaurant-settings/routes.ts`: yes.
- App-host `/app` normalization and proxy behavior reviewed from `lib/url/opsHref.ts` and `src/proxy.ts`: yes.
- Existing baseline inventory reviewed and reused as UX evidence: yes.
- Component hotspots identified with concrete files and current line counts: yes.
- Test references checked for route shell and route component coverage: yes.
- Browser/runtime verification performed: no, docs-only task; no runtime behavior changed.
