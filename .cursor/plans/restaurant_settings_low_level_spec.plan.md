---
name: restaurant-settings-low-level-spec
overview: Implementation-ready low-level spec for restaurant settings field IA — status vs codebase, exact contracts, test cases, and remaining gaps. Supersedes mid-level plans for execution detail; profile and most cross-cutting work are already landed.
todos:
  - id: verify-profile
    content: Run profile verification checklist (section 2) — vitest + browser 1280/768
    status: pending
  - id: verify-other-routes
    content: Run per-route verification tables (sections 3–8) on app.localhost
    status: pending
  - id: tests-setup-overview
    content: Add tests/components/RestaurantSetupOverview.test.tsx per section 3.4
    status: completed
  - id: tests-gbp-orphans
    content: Confirm no orphan GBP workflow files; run GoogleBusinessProfileSection.test.tsx
    status: completed
  - id: team-form-groups
    content: Optional — TeamInviteForm subheadings (section 8.2) if product wants parity
    status: completed
  - id: update-plan-todos
    content: Mark profile_field_ia_polish plan todos completed after verification passes
    status: pending
isProject: false
---

# Restaurant settings — low-level implementation spec

**Purpose:** Executable detail for engineers and agents: file paths, DOM anchors, props, payloads, and test assertions.  
**Companion docs:** [profile_field_ia_polish_277a018c.plan.md](profile_field_ia_polish_277a018c.plan.md) (mid-level), [gbp_settings_ia_audit_9f954672.plan.md](gbp_settings_ia_audit_9f954672.plan.md) (GBP audit).  
**Task folder:** `tasks/restaurant-settings-field-ia-YYYYMMDD-HHMM/`

---

## 0. Implementation status (read first)

Most mid-level plan items are **already in the repo** (as of this spec). Do not re-implement without verifying.

| Area                              | Status | Primary evidence                                                                           |
| --------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Profile contact groups            | Done   | `ContactLocationSubform` — Location / Public contact / After visit + `Separator`           |
| Profile logo copy                 | Done   | `RestaurantLogoUploader` label "Restaurant logo"                                           |
| Profile booking full URL          | Done   | `buildPublicBookingUrl` in `lib/site-url.ts`; `AdvancedIdentitySubform`                    |
| Profile sticky save               | Done   | `actionPlacement="stickyBar"`, `UnifiedActionBar` + `onCancelActive`, `onResetDraftChange` |
| Profile discovery flatten         | Done   | `DiscoveryPanelsFrame` `embedded` branch — stacked `Card` + `profile-discovery-${family}`  |
| Profile rail steps                | Done   | `profileSections.ts` `setupStep` 1–5; rail label `1 · Brand`                               |
| Setup overview                    | Done   | `RestaurantSetupOverview.tsx`; `settings/restaurant/page.tsx`                              |
| Subnav grouping                   | Done   | `RestaurantSettingsSubnav` `NAV_GROUPS`                                                    |
| Save scope copy                   | Done   | `formatSaveScopeMessage` in `compactSettingsClasses.ts`                                    |
| Availability booking rules groups | Done   | `BookingRulesSubform` — Guest booking grid / Service cutoffs / policy                      |
| Availability schedule headings    | Done   | `Weekly open hours` block; `#availability-hours`                                           |
| Availability alias scroll         | Done   | `AvailabilityOccasionsCommandCenter` `useEffect` on `initialWorkspace`                     |
| Menu quick edit + sheet sections  | Done   | `MenuHierarchyManagementPanel` — Quick edit dialog; Essentials / Google publishing         |
| Menu rail dedupe                  | Done   | `OpsMenuManagementClient` `railClassName="hidden lg:block"`                                |
| Tables classification collapsible | Done   | "Classification & service notes"                                                           |
| GBP frame + empty states          | Done   | `GbpFrame`; `!data` shows card not `return null`                                           |
| GBP sync intro links              | Done   | `OpsRestaurantSettingsClient` intro above `DualSyncShell`                                  |

**Remaining work is mostly:** verification, missing tests, optional polish (Team subheadings), plan/doc sync.

---

## 1. Global contracts (do not break)

### 1.1 Routing

| External URL                                   | Internal page                                    | Client `view`             | Extra props                             |
| ---------------------------------------------- | ------------------------------------------------ | ------------------------- | --------------------------------------- |
| `/settings/restaurant`                         | `src/app/app/(app)/settings/restaurant/page.tsx` | —                         | Renders `RestaurantSetupOverview`       |
| `/settings/restaurant/profile`                 | `profile/page.tsx`                               | `profile`                 | —                                       |
| `/settings/restaurant/google-business-profile` | `google-business-profile/page.tsx`               | `google-business-profile` | `hasSyncWorkspace` from client          |
| `/settings/restaurant/availability`            | `availability/page.tsx`                          | `availability`            | `initialWorkspace` default `rules`      |
| `/settings/restaurant/operating-hours`         | `operating-hours/page.tsx`                       | `availability`            | `availabilityWorkspace="schedule"`      |
| `/settings/restaurant/service-periods`         | `service-periods/page.tsx`                       | `availability`            | `availabilityWorkspace="schedule"`      |
| `/settings/restaurant/occasions`               | `occasions/page.tsx`                             | `availability`            | `availabilityWorkspace="booking-types"` |
| `/settings/restaurant/turn-durations`          | `turn-durations/page.tsx`                        | `availability`            | `availabilityWorkspace="booking-types"` |
| `/settings/restaurant/menu`                    | `menu/page.tsx`                                  | `menu`                    | `?catalog=food\|drinks`                 |
| `/settings/restaurant/tables`                  | `tables/page.tsx`                                | `tables`                  | —                                       |
| `/settings/restaurant/team`                    | `team/page.tsx`                                  | `team`                    | —                                       |
| `/settings/restaurant/email-templates`         | redirect                                         | —                         | → `/app/email-templates`                |

### 1.2 Save scope messages

**File:** [`src/components/features/restaurant-settings/shared/compactSettingsClasses.ts`](src/components/features/restaurant-settings/shared/compactSettingsClasses.ts)

```ts
const SAVE_SCOPE_MESSAGES = {
  'availability-rules': 'Saves booking slot spacing and policy only.',
  'availability-schedule':
    'Saves weekly hours, service windows, date overrides, and booking types in this workspace.',
  discovery: 'Saves this discovery panel only.',
  menu: 'Saves only the selected menu, section, item, or option.',
  tables: 'Saves only this table, zone, or inventory action.',
  team: 'Sends this invitation only.',
} as const;
```

**Add new scopes only via this map** — never inline duplicate strings.

### 1.3 Subform props (shared)

**File:** [`components/ops/restaurants/RestaurantDetailsForm.tsx`](components/ops/restaurants/RestaurantDetailsForm.tsx)

```ts
type RestaurantDetailsSubformProps = {
  restaurantId: string | null;
  initialValues: RestaurantDetailsFormValues;
  formId?: string;
  actionPlacement?: 'inline' | 'stickyBar'; // default 'inline'
  onDirtyChange?: (dirty: boolean) => void;
  onDraftChange?: (draft, dirty) => void;
  onResetDraftChange?: (resetDraft: (() => void) | null) => void;
  gbpFieldVerifications?: Partial<Record<GbpComparableField, ProfileFieldVerification>>;
};
```

**`SubformActions` when `actionPlacement === 'stickyBar'`:**

- Renders: status lines + **Cancel changes** only (no Submit).
- Copy: _"Use the sticky profile bar to save this section."_

---

## 2. Profile route — verification spec (implemented)

**URL:** `http://app.localhost:3000/settings/restaurant/profile`  
**Root component:** [`RestaurantProfileSection.tsx`](src/components/features/restaurant-settings/RestaurantProfileSection.tsx)

### 2.1 Section rail contract

| `setupStep` | `id`            | `anchorId`              | `formId` (if any)                       | PATCH fields (partial)                                                                   |
| ----------- | --------------- | ----------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1           | `brand`         | `profile-identity`      | `restaurant-profile-brand-form`         | `name`, `businessDescription` (+ logo via uploader)                                      |
| 2           | `advanced`      | `profile-booking-url`   | `restaurant-profile-advanced-form`      | `slug`                                                                                   |
| 3           | `contact`       | `profile-contact`       | `restaurant-profile-contact-form`       | `timezone`, `contactEmail`, `contactPhone`, `address`, `googleMapUrl`, `googleReviewUrl` |
| 4           | `notifications` | `profile-notifications` | `restaurant-profile-notifications-form` | `managerNotificationPhone`, `managerDailySummaryEnabled`                                 |
| 5           | `discovery`     | `profile-discovery`     | —                                       | business-context families (separate API)                                                 |

**Rail label format:** `` `${setupStep} · ${navLabel}` `` (e.g. `3 · Contact`).

**Hash listener:** `window.location.hash` must match `PROFILE_ANCHOR_IDS`; sets `activeSectionId` and `scrollIntoView`.

### 2.2 Contact DOM order (assert in tests)

Inside `#profile-contact` form, top to bottom:

1. **Location** — `h2`/`<p class="text-sm font-semibold">` "Location"
   - Row 1: `#restaurant-timezone`, `#restaurant-address` (grid 2-col)
   - `#restaurant-google-map` + help _"Directions link for guests (Google Maps)."_
2. `Separator`
3. **Public contact** — phone `#restaurant-phone`, email `#restaurant-email`
4. `Separator`
5. **After visit** — `#restaurant-google-review` + help _"Post-visit review link; not the same as website/menu links in Discovery."_

### 2.3 Booking URL preview

- `buildPublicBookingUrl(slug)` → `{origin}/restaurants/{slug}/book` or `null`
- UI must show: relative path, full URL (`font-mono text-xs break-all`), **Copy full URL** (clipboard writes full URL)

### 2.4 Sticky bar

**When** any of `brand|contact|notifications|advanced` dirty:

- [`UnifiedActionBar`](src/components/features/restaurant-settings/profile/UnifiedActionBar.tsx): Submit `form={activeDirtySection.formId}`, optional **Cancel changes** via `onCancelActive` → calls registered `resetDraftHandlersRef[activeSection.dirtyKey]`
- Active pane `SubformActions`: no Submit button

**When** only `discovery` dirty: bar text directs to per-panel save.

### 2.5 Discovery embedded cards

For each `family` in `DISCOVERY_SECTION_ORDER`:

- Element: `#profile-discovery-${family}`
- Visible without accordion interaction
- Child panels retain per-family Save / Reset (unchanged mutations)

### 2.6 Profile tests (run)

```bash
pnpm exec vitest run \
  tests/components/RestaurantDetailsForm.test.tsx \
  tests/components/RestaurantLogoUploader.test.tsx \
  tests/components/RestaurantProfileSection.test.tsx \
  tests/components/RestaurantBusinessContextSection.test.tsx \
  tests/lib/site-url.test.ts
```

**Add if missing:**

```ts
// RestaurantProfileSection.test.tsx
it('shows sticky save and hides inline submit when brand is dirty', async () => { ... });
it('renders contact blocks in Location → Public contact → After visit order', () => { ... });
it('prefixes rail labels with setup steps', () => { ... });
```

### 2.7 Browser acceptance

- [ ] Switch rail sections; only one `ProfileSectionPane` visible (`hidden={!isActive}`)
- [ ] Dirty brand → sticky Save; inline form has Cancel only
- [ ] Cancel restores field values
- [ ] Discovery: six cards visible, scroll to `#profile-discovery-links`
- [ ] Copy full booking URL works on HTTPS/localhost

---

## 3. Setup overview — verification + tests

**URL:** `/settings/restaurant`  
**Component:** [`RestaurantSetupOverview.tsx`](src/components/features/restaurant-settings/RestaurantSetupOverview.tsx)

### 3.1 Readiness logic (do not change without product sign-off)

| Card key     | Complete when                                                            |
| ------------ | ------------------------------------------------------------------------ |
| Profile      | `deriveReadiness`-equivalent: name, slug, timezone, contactPhone present |
| Availability | operating hours + service periods queries return usable data             |
| Tables       | `tablesQuery.data.summary.totalTables > 0`                               |
| Menu         | optional — menu hierarchy has ≥1 item                                    |
| Team         | optional — pending invites or members                                    |
| Google       | optional — connection `status === 'linked'`                              |

### 3.2 Card DOM

Each card: `SettingsCard` + `Badge` (Complete / Needs attention / Optional) + CTA `Button asChild` → `opsHref(...)`.

### 3.3 Tests to add

**New file:** `tests/components/RestaurantSetupOverview.test.tsx`

```ts
describe('RestaurantSetupOverview', () => {
  it('renders required setup cards with links to profile, availability, and tables', () => {});
  it('marks profile as needs attention when name is missing', () => {});
  it('shows skeletons while restaurant details are loading', () => {});
});
```

Mock: `useOpsRestaurantDetails`, `useOpsOperatingHours`, `useOpsServicePeriods`, table list query.

---

## 4. Google Business Profile — low-level spec

**URL:** `/settings/restaurant/google-business-profile`  
**Components:** [`GoogleBusinessProfileSection.tsx`](src/components/features/restaurant-settings/google-business-profile/GoogleBusinessProfileSection.tsx), [`OpsRestaurantSettingsClient.tsx`](src/components/features/restaurant-settings/OpsRestaurantSettingsClient.tsx) (`DualSyncShell`)

### 4.1 Anchors

| `id`              | When visible                                              | Content                                                                                                                       |
| ----------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `gbp-connection`  | `showConnect`                                             | [`ConnectCard`](src/components/features/restaurant-settings/google-business-profile/components/ConnectCard.tsx)               |
| `gbp-location`    | `showPicker` (`authorized` / `reauth_required`)           | [`LocationPickerCard`](src/components/features/restaurant-settings/google-business-profile/components/LocationPickerCard.tsx) |
| `gbp-sync-review` | `view === 'google-business-profile'` && `dualSyncEnabled` | Intro + [`DualSyncShell`](src/components/features/restaurant-settings/dual-sync/DualSyncShell.tsx)                            |

**Rail** (`GbpFrame`): Connection → Location → Review (Review disabled until linked / sync workspace).

### 4.2 Location card fields (no schema change)

| UI label      | Control                          | Notes                                                                            |
| ------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| Location list | `Select` of `availableLocations` | `buildLocationValue(location)` as value                                          |
| Listing title | read-only in picker detail       | from `selectedLocation.title`                                                    |
| Account       | read-only                        | `accountDisplayName`                                                             |
| Address       | read-only                        | `addressText`                                                                    |
| Primary CTA   | Link location                    | `linkMutation` payload: `accountName`, `accountId`, `locationName`, `locationId` |

**Helper (add under card title if missing):**  
_"Pick the Google listing that matches this restaurant's name and address."_

### 4.3 State matrix (all must use `GbpFrame` + overview actions)

| Condition               | Render                               |
| ----------------------- | ------------------------------------ |
| `!restaurantId`         | Card: select restaurant message      |
| `isLoading && !data`    | `LoadingSkeleton` inside frame       |
| `error`                 | Destructive alert + Retry            |
| `!data` (success empty) | Card: refresh hint (not blank page)  |
| `data` + linked         | Connect and/or picker + linked alert |

### 4.4 `routes.ts` copy

```ts
description: 'Optional: connect Google to import and compare public details.',
```

Must match page metadata (derive from `getRoute('google-business-profile')` in page.tsx).

### 4.5 Orphan deletion checklist

Confirm **zero imports** in `src/` then delete if present:

- `LinkedSummaryCard.tsx`, `PreflightReviewDialog.tsx`, `PublishPasswordDialog.tsx`
- `lib/drift.ts`, `lib/sync-review.ts` under google-business-profile

**Keep:** `googleBusinessProfileVerification.ts`, `GoogleBusinessProfileComparisonBadge` (Profile uses).

### 4.6 Tests

```bash
pnpm exec vitest run tests/components/GoogleBusinessProfileSection.test.tsx
```

Assertions:

- Single page h1 from shell (no duplicate section `PageHeader` h1)
- `!data` renders retry card inside frame
- Hash `#gbp-location` scrolls when picker visible

---

## 5. Availability — low-level spec

**URL:** `/settings/restaurant/availability` (+ aliases)  
**Components:** [`AvailabilityOccasionsCommandCenter.tsx`](src/components/features/restaurant-settings/AvailabilityOccasionsCommandCenter.tsx), [`AvailabilityScheduleManager.tsx`](src/components/features/restaurant-settings/AvailabilityScheduleManager.tsx), [`BookingRulesCard`](src/components/features/restaurant-settings/AvailabilityOccasionsCommandCenter.tsx)

### 5.1 Workspace visibility

| `activeWorkspace` | Visible block                          | Hidden                           |
| ----------------- | -------------------------------------- | -------------------------------- |
| `rules`           | `#booking-rules` / `BookingRulesCard`  | `AvailabilityScheduleManager`    |
| `schedule`        | Schedule manager `isScheduleWorkspace` | rules card                       |
| `booking-types`   | Occasions + turn bands                 | rules card; schedule tabs hidden |

**On mount:** `useEffect` scrolls to hash from `initialWorkspace`:

- `rules` → `#booking-rules`
- `schedule` → `#availability-schedule`
- `booking-types` → `#booking-occasions`

### 5.2 Booking rules field map

**Form:** default `formId` from subform; `saveScopeMessage={formatSaveScopeMessage('availability-rules')}`

| Group heading       | Field ids                                                 | PATCH keys                                                                |
| ------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| Guest booking grid  | `#restaurant-interval`, `#restaurant-duration`            | `reservationIntervalMinutes`, `reservationDefaultDurationMinutes`         |
| Service cutoffs     | `#restaurant-last-seating`, `#restaurant-lifecycle-grace` | `reservationLastSeatingBufferMinutes`, `reservationLifecycleGraceMinutes` |
| Guest-facing policy | `#restaurant-booking-policy` (textarea)                   | `bookingPolicy`                                                           |

### 5.3 Schedule workspace DOM

Inside `#availability-schedule` card:

1. Optional combined alert (if implementing alert merge): bullets for save model + custom periods preserved
2. **Tabs:** `schedule` | `overrides`
3. Tab `schedule`:
   - Subheading: **Weekly open hours** (`#availability-hours` wrapper)
   - Day cards: `AvailabilityScheduleDayCard` × 7
   - Nested meal toggles per day (lunch/dinner)
4. Tab `overrides`: `AvailabilityOverridesEditor`

**Booking types workspace:**

- Subheading + `AvailabilityOccasionsEditor`
- Turn bands editor
- Inline link: _"Booking slot spacing lives under Booking rules"_ → `selectWorkspace('rules')`

### 5.4 Save footer (`AvailabilityScheduleManager`)

**Button:** disabled unless `canSave` (dirty + validation).  
**Adjacent copy:** `<p>{formatSaveScopeMessage('availability-schedule')}</p>`

**PATCH domains (unchanged):** hours, services, occasions, turn bands — single handler; partial failure surfaces `saveState.details[]`.

### 5.5 Alias page contract

| Page file                  | `availabilityWorkspace` | Expected hash scroll                |
| -------------------------- | ----------------------- | ----------------------------------- |
| `operating-hours/page.tsx` | `schedule`              | `#availability-schedule`            |
| `service-periods/page.tsx` | `schedule`              | `#service-periods` or schedule card |
| `occasions/page.tsx`       | `booking-types`         | `#booking-occasions`                |
| `turn-durations/page.tsx`  | `booking-types`         | turn band section                   |

### 5.6 Tests

```bash
pnpm exec vitest run tests/components/RestaurantDetailsForm.test.tsx tests/components/AvailabilitySettingsComponents.test.tsx
```

**Add:**

```ts
it('BookingRulesSubform renders Guest booking grid and Service cutoffs headings', () => {});
it('scrolls to availability-schedule when initialWorkspace is schedule', () => {});
```

---

## 6. Menu — low-level spec

**URL:** `/settings/restaurant/menu?catalog=food|drinks`  
**Components:** [`OpsMenuManagementClient.tsx`](src/components/features/menu/OpsMenuManagementClient.tsx), [`MenuHierarchyManagementPanel.tsx`](src/components/features/menu/MenuHierarchyManagementPanel.tsx)

### 6.1 Layout breakpoints

| Viewport | Catalogue switcher location                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `lg+`    | `RestaurantSettingsCommandCenter` rail only (`railClassName="hidden lg:block"` on mobile rail inverse — rail hidden below lg) |
| `<lg`    | Inline `nav` with Food / Drinks buttons only                                                                                  |

### 6.2 Quick edit dialog

**Trigger:** row action **Quick edit** → sets `quickEditItem`  
**Component:** dialog in `MenuHierarchyManagementPanel` (~line 2014)

**Fields:**

| Label             | State          | Maps to                                            |
| ----------------- | -------------- | -------------------------------------------------- |
| Currency          | `currencyCode` | `attributes.price.currencyCode`                    |
| Price             | `price`        | `attributes.price.amount`                          |
| Availability flag | Select         | `extensions.availabilityPolicy.availabilityStatus` |
| Active            | Switch         | `active`                                           |
| Sold out          | Switch         | `extensions.availabilityPolicy.soldOut`            |

**Submit:** partial item PATCH — must not wipe modifiers/allergens/Google fields.

**Parity:** same Quick edit entry point on **drinks** rows (if missing, add mirror in drink row renderer).

### 6.3 Full sheet section headers

**File:** `MenuItemSheet` / drink sheet within `MenuHierarchyManagementPanel`

Required `<h3>` sections in order:

1. **Essentials** — name, price, active, core description
2. **Guest menu** — dietary, allergens, guest copy
3. **Google publishing** — `Collapsible` default **closed**
4. **Import metadata** — `Collapsible` default **closed**

### 6.4 Footer

In `OpsMenuManagementClient` footer prop:

_"Menu publishing fields are edited here. Google connection and field review: [Google Business Profile](<opsHref(...)>)."_

### 6.5 Tests to add

```ts
// tests/components/MenuQuickEdit.test.tsx (new)
it('quick edit updates price without clearing modifiers', async () => {});
it('opens full sheet with Essentials section expanded', async () => {});
```

---

## 7. Tables — low-level spec

**URL:** `/settings/restaurant/tables`  
**Component:** [`TableInventoryClient.tsx`](src/components/features/tables/TableInventoryClient.tsx)

### 7.1 Workspaces

| Workspace   | `hash`                    | Primary UI           |
| ----------- | ------------------------- | -------------------- |
| `summary`   | `#table-capacity-summary` | Metric cards         |
| `zones`     | `#table-zones`            | Zone management      |
| `inventory` | `#table-inventory`        | Table grid + filters |

### 7.2 `TableForm` dialog blocks

| Block                                        | Fields                                                              | Required on create    |
| -------------------------------------------- | ------------------------------------------------------------------- | --------------------- |
| Capacity                                     | `tableNumber`, `capacity`, `minPartySize`, `maxPartySize`           | number, capacity      |
| Placement                                    | `zoneId` Select, `active` Switch                                    | zone optional if none |
| Classification & service notes (collapsible) | `section`, `category`, `seatingType`, `mobility`, `status`, `notes` | all optional          |

**First table (`isFirstTable`):** `DialogDescription` emphasizes number + capacity; collapsible **closed** by default.

### 7.3 Empty inventory helper

When `tables.length === 0` and not loading, above grid:

_"Add tables with number and capacity first. Zones and classification can be added later."_

### 7.4 Save scope

Zone/table mutations: show toast; optional inline `formatSaveScopeMessage('tables')` on dialog footers.

### 7.5 Tests

```ts
it('hides classification collapsible open state for first table', () => {});
it('submits create payload with only core fields when collapsible closed', () => {});
```

---

## 8. Team — low-level spec

**URL:** `/settings/restaurant/team`  
**Component:** [`OpsTeamManagementClient.tsx`](src/components/features/team/OpsTeamManagementClient.tsx)

### 8.1 Workspaces

| Workspace     | Hash                | Component                                                               |
| ------------- | ------------------- | ----------------------------------------------------------------------- |
| `invite`      | `#team-invite`      | [`TeamInviteForm`](src/components/features/team/TeamInviteForm.tsx)     |
| `invitations` | `#team-invitations` | [`TeamInvitesTable`](src/components/features/team/TeamInvitesTable.tsx) |

Non-managers: force `invitations` only; hide invite rail item.

### 8.2 Optional polish — invite form groups

**File:** `TeamInviteForm.tsx`

Wrap fields:

```tsx
<div className="flex flex-col gap-1">
  <p className="text-sm font-semibold">Who to invite</p>
  <p className="text-xs text-muted-foreground">Email and role for the new teammate.</p>
</motion.div>
// FormField email, FormField role
```

Footer: `formatSaveScopeMessage('team')` on submit button area.

### 8.3 Invitations table column order

`email` → `role` → `status` (Badge) → `createdAt` → actions (revoke/resend)

---

## 9. Cross-route verification matrix

| Route        | Widths    | Critical interactions                          |
| ------------ | --------- | ---------------------------------------------- |
| Overview     | 1280, 768 | Cards link correctly; status badges match data |
| Profile      | 1280, 768 | §2.7                                           |
| GBP          | 1280, 768 | Connect/picker/sync intro; hash navigation     |
| Availability | 1280, 768 | 3 workspaces; save schedule; alias URLs        |
| Menu         | 1280, 768 | Quick edit; sheet collapsibles; catalog switch |
| Tables       | 1280, 768 | Add table dialog; workspaces                   |
| Team         | 1280, 768 | Invite flow; permissions gate                  |

**Commands:**

```bash
pnpm run lint && pnpm run typecheck
pnpm exec vitest run tests/components/RestaurantSetupOverview.test.tsx  # after added
pnpm exec vitest run tests/components/GoogleBusinessProfileSection.test.tsx \
  tests/components/AvailabilitySettingsComponents.test.tsx \
  tests/components/RestaurantSettingsShell.test.tsx
```

Document in `tasks/.../verification.md` per [nabatable-ui-proof](.codex/skills/nabatable-ui-proof/SKILL.md).

---

## 10. Suggested execution order (remaining only)

1. Run §2–9 verification on app.localhost; file gaps in `verification.md`
2. Add `RestaurantSetupOverview.test.tsx` (§3.3)
3. Add menu quick-edit regression test (§6.5)
4. Optional Team form groups (§8.2)
5. Mark [profile_field_ia_polish_277a018c.plan.md](profile_field_ia_polish_277a018c.plan.md) todos **completed** if verification passes
6. Delete any confirmed orphan GBP files (§4.5)

---

## 11. Non-goals (unchanged)

- API / DB schema changes
- Dual-sync publish pipeline behavior
- Guest/public routes
- Email-templates redirect route
