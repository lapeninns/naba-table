# Restaurant Profile Route Audit

Captured: 2026-05-06 23:34 Europe/London  
Scope: shipped app-host route `http://app.localhost:3000/settings/restaurant/profile`  
Baseline note: `docs/restaurant-settings-full-diagnostic-20260506-2037.md` is the broader
settings diagnostic. This document narrows to the current profile route contract and browser
sanity check.

## Summary

`/settings/restaurant/profile` is a protected app-host settings route. The page is a thin
handoff into `OpsRestaurantSettingsClient view="profile"` and renders only
`RestaurantProfileSection` for the profile body. Dual-sync review UI is not mounted on this route,
even when the feature flag is enabled, because the dual-sync section map only contains
`google-business-profile`.

The profile body is organized into five anchored cards:

- `#profile-identity`: logo, name, business description.
- `#profile-contact`: timezone, public contact details, address, map/review links.
- `#profile-booking-url`: public booking slug.
- `#profile-notifications`: manager alert SMS settings.
- `#profile-discovery`: collapsible optional discovery editor.

Browser verification on the real app-host route succeeded for signed-in load, subnav/header/badge,
anchor visibility, sticky unsaved controls, and link targets. To keep the audit read-only, I did
not click any save button or trigger remote `PATCH` mutations.

## Route + Auth Boundary

| Host context       | External path                                           | Internal file or handler                                 | Expected proxy behavior                                                                                                       | Auth expectation                                        |
| ------------------ | ------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| app host           | `http://app.localhost:3000/settings/restaurant/profile` | `src/app/app/(app)/settings/restaurant/profile/page.tsx` | app-host non-API page paths rewrite to `/app/*` in `src/proxy.ts`                                                             | middleware and layout require authenticated ops session |
| app host transport | `/app/settings/restaurant/profile`                      | same page file                                           | app-host `/app/*` strips to `/settings/restaurant/profile`; root-host `/app/*` redirects to app host outside single-host mode | same protected restaurant route                         |

- The route page exports metadata and returns `<OpsRestaurantSettingsClient view="profile" />`
  (`src/app/app/(app)/settings/restaurant/profile/page.tsx:5`,
  `src/app/app/(app)/settings/restaurant/profile/page.tsx:10`).
- The settings layout resolves the Supabase user with `supabase.auth.getUser()` and redirects
  unauthenticated users to `/app/auth/signin` with `/app/settings/restaurant/profile` as the
  `redirectedFrom` target before rendering `RestaurantSettingsPageShell`
  (`src/app/app/(app)/settings/restaurant/layout.tsx:9`,
  `src/app/app/(app)/settings/restaurant/layout.tsx:20`).
- `src/proxy.ts` identifies `app.localhost` as the app host, strips `/app` on app-host requests,
  rewrites protected app pages to `/app/*`, and checks Supabase auth before returning the rewrite
  (`src/proxy.ts:59`, `src/proxy.ts:214`, `src/proxy.ts:270`, `src/proxy.ts:275`).
- `opsHref('/settings/restaurant/profile')` produces `/app/settings/restaurant/profile`; the
  shell/subnav normalize paths back to `/settings/restaurant/profile` when matching active routes
  (`lib/url/opsHref.ts:27`, `lib/url/opsHref.ts:32`,
  `src/components/features/restaurant-settings/RestaurantSettingsPageShell.tsx:32`,
  `src/components/features/restaurant-settings/RestaurantSettingsSubnav.tsx:42`).

## Shell + View Router

`RestaurantSettingsPageShell` owns the route chrome:

- Uses `usePathname()` plus `RESTAURANT_SETTINGS_NAV_ITEMS` to derive active title and description
  (`src/components/features/restaurant-settings/RestaurantSettingsPageShell.tsx:46`,
  `src/components/features/restaurant-settings/RestaurantSettingsPageShell.tsx:50`).
- Renders `OpsPageHeader` with eyebrow `Settings`, title, description, and an `Editing`
  restaurant badge from active membership/session state
  (`src/components/features/restaurant-settings/RestaurantSettingsPageShell.tsx:63`,
  `src/components/features/restaurant-settings/RestaurantSettingsPageShell.tsx:72`).
- Mounts `RestaurantSettingsSubnav` above compact route content
  (`src/components/features/restaurant-settings/RestaurantSettingsPageShell.tsx:91`).

`routes.ts` defines the profile nav metadata:

- `href`: `/app/settings/restaurant/profile`
- `title`: `Restaurant profile`
- `description`: `Public details, booking page URL, manager alerts, and optional discovery.`
  (`src/components/features/restaurant-settings/routes.ts:19`,
  `src/components/features/restaurant-settings/routes.ts:21`).

`OpsRestaurantSettingsClient` routes `view="profile"` to one component:

- Dynamic import `RestaurantProfileSection`
  (`src/components/features/restaurant-settings/OpsRestaurantSettingsClient.tsx:73`).
- `renderByView.profile` returns `<RestaurantProfileSection restaurantId={restaurantId} />`
  (`src/components/features/restaurant-settings/OpsRestaurantSettingsClient.tsx:185`,
  `src/components/features/restaurant-settings/OpsRestaurantSettingsClient.tsx:190`).
- `DUAL_SYNC_SECTIONS_BY_VIEW` only has `google-business-profile`; it does not include `profile`
  (`src/components/features/restaurant-settings/OpsRestaurantSettingsClient.tsx:126`,
  `src/components/features/restaurant-settings/OpsRestaurantSettingsClient.tsx:129`).
- Dual-sync shell only renders when `dualSyncEnabled && dualSyncSections && selectedRestaurantId`;
  for `view="profile"`, `dualSyncSections` is undefined
  (`src/components/features/restaurant-settings/OpsRestaurantSettingsClient.tsx:202`,
  `src/components/features/restaurant-settings/OpsRestaurantSettingsClient.tsx:208`).

## Profile Body UI Tree

The body is implemented in `RestaurantProfileSection`
(`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:117`).

`ProfileShell` chrome:

- Top action links to `GoogleBusinessProfile` plus `#gbp-connection`
  (`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:59`,
  `src/components/features/restaurant-settings/RestaurantProfileSection.tsx:91`).
- Bottom `Related settings` alert links to Availability `#booking-rules` and Team
  (`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:99`,
  `src/components/features/restaurant-settings/RestaurantProfileSection.tsx:103`,
  `src/components/features/restaurant-settings/RestaurantProfileSection.tsx:107`).

Sticky unsaved bar:

- `dirtyState` tracks `brand`, `contact`, `notifications`, `discovery`, and `advanced`
  (`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:121`).
- `PROFILE_DIRTY_SECTIONS` maps dirty keys to labels, anchors, form ids, and action labels
  (`src/components/features/restaurant-settings/restaurantProfileModel.ts:58`).
- When any section is dirty, the sticky alert renders a dirty section count, `Save all` for more
  than one dirty form section, and per-section submit buttons with `form={section.formId}`
  (`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:392`,
  `src/components/features/restaurant-settings/RestaurantProfileSection.tsx:408`,
  `src/components/features/restaurant-settings/RestaurantProfileSection.tsx:413`).
- `handleSaveAllProfileForms` emits analytics and calls `requestSubmit()` on each dirty form id
  (`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:245`,
  `src/components/features/restaurant-settings/RestaurantProfileSection.tsx:254`).

Profile sections:

| Anchor                   | Card                       | Form id                                 | Components                                              | Fields owned                                                                                                              |
| ------------------------ | -------------------------- | --------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `#profile-identity`      | Brand and identity         | `restaurant-profile-brand-form`         | `RestaurantLogoUploader`, `BrandIdentitySubform`        | logo, `name`, `businessDescription`                                                                                       |
| `#profile-contact`       | Contact and location       | `restaurant-profile-contact-form`       | `ContactLocationSubform`                                | `timezone`, `contactEmail`, `contactPhone`, `address`, `googleMapUrl`, `googleReviewUrl`                                  |
| `#profile-booking-url`   | Booking page URL           | `restaurant-profile-advanced-form`      | `AdvancedIdentitySubform`                               | `slug`                                                                                                                    |
| `#profile-notifications` | Manager alerts             | `restaurant-profile-notifications-form` | `ManagerNotificationsSubform`                           | `managerNotificationPhone`, `managerDailySummaryEnabled`                                                                  |
| `#profile-discovery`     | Optional discovery details | none at profile level                   | collapsible `RestaurantBusinessContextSection embedded` | business details, categories, attributes, links; service areas and service items behind nested import-metadata disclosure |

Form ids are centralized in `PROFILE_SECTION_FORMS`
(`src/components/features/restaurant-settings/restaurantProfileModel.ts:47`). The full dirty-section
registry also includes the discovery anchor without a form id because discovery saves through
business-context family actions instead of the restaurant-details subform ids
(`src/components/features/restaurant-settings/restaurantProfileModel.ts:80`).

The subform field ownership is source-defined in `RestaurantDetailsForm.tsx`:

- `BRAND_FIELDS`: `name`, `businessDescription`
  (`components/ops/restaurants/RestaurantDetailsForm.tsx:305`).
- `CONTACT_FIELDS`: `timezone`, `contactEmail`, `contactPhone`, `address`, `googleMapUrl`,
  `googleReviewUrl` (`components/ops/restaurants/RestaurantDetailsForm.tsx:306`).
- `NOTIFICATION_FIELDS`: `managerNotificationPhone`, `managerDailySummaryEnabled`
  (`components/ops/restaurants/RestaurantDetailsForm.tsx:314`).
- `ADVANCED_FIELDS`: `slug` (`components/ops/restaurants/RestaurantDetailsForm.tsx:318`).
- Booking-rule fields exist in the shared form model but are intentionally not rendered on Profile;
  the profile model comments identify Availability's `BookingRulesSubform` as their canonical home
  (`src/components/features/restaurant-settings/restaurantProfileModel.ts:9`,
  `components/ops/restaurants/RestaurantDetailsForm.tsx:319`).

Discovery embedded mode:

- `RestaurantBusinessContextSection` receives `embedded` and `onDirtyChange`
  (`src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx:52`).
- Embedded `DiscoveryFrame` renders without another `SettingsCard`
  (`src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx:41`).
- Embedded `DiscoveryPanelsFrame` renders ordered sections instead of tabs, using
  `EMBEDDED_DISCOVERY_PRIMARY_ORDER` and `EMBEDDED_DISCOVERY_MORE_ORDER`
  (`src/components/features/restaurant-settings/RestaurantBusinessContextPanels.tsx:179`,
  `src/components/features/restaurant-settings/businessContextModel.ts:127`).
- Primary embedded order is `businessDetails`, `categories`, `attributes`, `links`; service areas
  and service items are inside the nested `Import metadata and service areas` collapsible
  (`src/components/features/restaurant-settings/businessContextModel.ts:127`,
  `src/components/features/restaurant-settings/businessContextModel.ts:134`,
  `src/components/features/restaurant-settings/RestaurantBusinessContextPanels.tsx:192`).

## Data + Side Effects

| Hook / side effect                                                          | Responsibility on this route                                                                                                                                                   | Source                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useOpsRestaurantDetails(restaurantId)`                                     | Fetches the restaurant profile using `queryKeys.opsRestaurants.detail(restaurantId)`, enabled only with a restaurant id, with 2-minute stale time.                             | `src/hooks/ops/useOpsRestaurantDetails.ts:20`                                                                                                                                                                                           |
| `useOpsUpdateRestaurantDetails(restaurantId)`                               | Sends partial profile updates through `restaurantService.updateProfile`, then writes the returned profile into the detail query cache. Used by each subform and logo uploader. | `src/hooks/ops/useOpsRestaurantDetails.ts:40`                                                                                                                                                                                           |
| `useOpsGoogleBusinessProfileConnection(restaurantId)`                       | Fetches GBP connection state with 30-second stale time. Profile uses it only to derive verification badges for comparable fields; dual-sync review UI is not mounted here.     | `src/hooks/ops/useOpsGoogleBusinessProfile.ts:21`, `src/components/features/restaurant-settings/RestaurantProfileSection.tsx:194`                                                                                                       |
| `useRegisterOpsUnsavedChanges('restaurant-profile', ...)`                   | Registers the global unsaved-changes prompt while any profile dirty state is true.                                                                                             | `src/components/features/restaurant-settings/RestaurantProfileSection.tsx:151`                                                                                                                                                          |
| `useOpsRestaurantBusinessContext` / `useOpsUpdateRestaurantBusinessContext` | Used inside embedded discovery to read/save business context families. The profile-level dirty state receives aggregate discovery dirty state through `onDirtyChange`.         | `src/hooks/ops/useOpsRestaurantBusinessContext.ts:20`, `src/components/features/restaurant-settings/useRestaurantBusinessContextEditor.ts:59`                                                                                           |
| `RestaurantLogoUploader`                                                    | Uploads logo files through `useOpsRestaurantLogoUpload`, then updates profile `logoUrl` through the same restaurant-details mutation hook; remove also sends `logoUrl: null`.  | `src/components/features/restaurant-settings/RestaurantLogoUploader.tsx:53`, `src/components/features/restaurant-settings/RestaurantLogoUploader.tsx:104`, `src/components/features/restaurant-settings/RestaurantLogoUploader.tsx:129` |

Client service path:

- `getProfile` calls `GET /api/ops/restaurants/{restaurantId}`
  (`src/services/ops/restaurants.ts:1244`).
- `updateProfile` calls `PATCH /api/ops/restaurants/{restaurantId}` with JSON
  (`src/services/ops/restaurants.ts:1257`).
- The API route GET requires a user and membership before reading restaurant data
  (`src/app/api/ops/restaurants/[id]/route.ts:53`,
  `src/app/api/ops/restaurants/[id]/route.ts:76`).
- The API route PATCH is CSRF protected, requires an authenticated user and admin membership,
  validates with `updateRestaurantSchema`, then updates restaurant fields and upserts business
  description if provided (`src/app/api/ops/restaurants/[id]/route.ts:164`,
  `src/app/api/ops/restaurants/[id]/route.ts:191`,
  `src/app/api/ops/restaurants/[id]/route.ts:216`,
  `src/app/api/ops/restaurants/[id]/route.ts:228`,
  `src/app/api/ops/restaurants/[id]/route.ts:254`).

Analytics emitted by `RestaurantProfileSection`:

| Event                                    | Trigger                                                  | Payload shape notes                                                               |
| ---------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `restaurant_profile_editor_viewed`       | first successful profile data load per restaurant id     | restaurant id, completeness score, completed/missing counts, missing field keys   |
| `restaurant_profile_edit_started`        | first dirty section in a route session                   | restaurant id, dirty section count/keys, completeness score, elapsed ms           |
| `restaurant_profile_dropoff_before_save` | pagehide, beforeunload, or visibility hidden while dirty | restaurant id, dirty section count/keys, elapsed ms                               |
| `restaurant_profile_save_all_clicked`    | sticky `Save all` click                                  | restaurant id, dirty form sections, completeness score, missing count, elapsed ms |

The events are emitted through both `track` and `emit`
(`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:67`). They are included
in the central analytics event allowlist (`lib/analytics.ts:36`).

Subform analytics emitted by `RestaurantDetailsForm.tsx`:

- `restaurant_profile_validation_error`
- `restaurant_profile_section_saved`
- `restaurant_profile_section_save_failed`

These are emitted in the shared subform submit path
(`components/ops/restaurants/RestaurantDetailsForm.tsx:123`,
`components/ops/restaurants/RestaurantDetailsForm.tsx:219`,
`components/ops/restaurants/RestaurantDetailsForm.tsx:244`,
`components/ops/restaurants/RestaurantDetailsForm.tsx:256`).

Hash-scroll listener:

- `PROFILE_ANCHOR_IDS` contains `profile-identity`, `profile-contact`, `profile-booking-url`,
  `profile-notifications`, and `profile-discovery`
  (`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:43`).
- On mount and `hashchange`, valid hashes call
  `document.getElementById(raw)?.scrollIntoView({ block: 'start', behavior: 'smooth' })`
  (`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:157`,
  `src/components/features/restaurant-settings/RestaurantProfileSection.tsx:164`).

## Cross-Links Inventory

Outbound links from the profile body:

| Link text                                       | Href source                         | Runtime href                                                      | Purpose                                        |
| ----------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------- |
| `Google is optional: import or compare details` | `${REVIEW_GBP_HREF}#gbp-connection` | `/app/settings/restaurant/google-business-profile#gbp-connection` | top CTA to GBP connection/import/comparison    |
| `Availability & Booking types`                  | `AVAILABILITY_BOOKING_RULES_HREF`   | `/app/settings/restaurant/availability#booking-rules`             | related setting for booking rules              |
| `Team`                                          | `TEAM_HREF`                         | `/app/settings/restaurant/team`                                   | related setting for staff access               |
| `Google Business Profile page`                  | discovery alert                     | `/app/settings/restaurant/google-business-profile`                | optional discovery comparison/import workspace |
| `Google Business Profile workspace`             | embedded discovery metadata alert   | `/app/settings/restaurant/google-business-profile`                | provider-level service/raw metadata workspace  |

Sources: `src/components/features/restaurant-settings/RestaurantProfileSection.tsx:59`,
`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:93`,
`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:103`,
`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:107`,
`src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx:129`,
`src/components/features/restaurant-settings/RestaurantBusinessContextPanels.tsx:222`.

Inbound deep links supported by the route:

- `/settings/restaurant/profile#profile-identity`
- `/settings/restaurant/profile#profile-contact`
- `/settings/restaurant/profile#profile-booking-url`
- `/settings/restaurant/profile#profile-notifications`
- `/settings/restaurant/profile#profile-discovery`

Each corresponds to a rendered `id` on the card wrapper
(`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:435`,
`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:459`,
`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:475`,
`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:490`,
`src/components/features/restaurant-settings/RestaurantProfileSection.tsx:505`).

## Existing Test Coverage Map

| Test file                                                    | What it already asserts                                                                                                                                                                                                                      | Coverage caveat                                                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `tests/components/RestaurantProfileSection.test.tsx`         | Sticky save bar submits two dirty forms, `Save all` analytics avoids edited values, profile card stack renders, all five anchors exist, top GBP CTA and Availability/Team links have expected hrefs, model derives profile values/readiness. | Component-level only; no real browser route, auth, or remote data.                                     |
| `tests/components/RestaurantDetailsForm.test.tsx`            | Brand partial payload, contact payload without booking rules, manager alert E.164 validation, Availability booking-rule subform payload, GBP badges, helper copy, model mapping/sanitization/completion analytics.                           | Subform-level only; does not prove route shell or profile sticky bar.                                  |
| `tests/components/RestaurantSettingsRoutePages.test.tsx`     | Each shipped settings page is metadata plus `OpsRestaurantSettingsClient` with the expected view, including profile.                                                                                                                         | Does not execute layout auth/proxy or browser navigation.                                              |
| `tests/components/RestaurantSettingsShell.test.tsx`          | Route/nav contract, every view dispatch through shared settings client, no-access state, selected restaurant id handoff, compact shell class, all subnav links and active state, prefetch service calls.                                     | Mocks `next/dynamic` and disables dual-sync flag; does not test real route rendering.                  |
| `tests/components/RestaurantBusinessContextSection.test.tsx` | Discovery editor saves parsed family payloads, embedded mode renders ordered subsections instead of tabs, service-area/attribute editor payloads, embedded chips/amenities save behavior, model serialization helpers.                       | Component-level discovery coverage; profile route only sees it through the collapsible embedded mount. |

Representative evidence:

- Sticky `Save all`, anchors, and cross-links:
  `tests/components/RestaurantProfileSection.test.tsx:134`,
  `tests/components/RestaurantProfileSection.test.tsx:208`,
  `tests/components/RestaurantProfileSection.test.tsx:219`.
- Partial restaurant details payloads:
  `tests/components/RestaurantDetailsForm.test.tsx:69`,
  `tests/components/RestaurantDetailsForm.test.tsx:142`,
  `tests/components/RestaurantDetailsForm.test.tsx:165`.
- Route page handoff:
  `tests/components/RestaurantSettingsRoutePages.test.tsx:35`,
  `tests/components/RestaurantSettingsRoutePages.test.tsx:73`.
- Shell/nav dispatch and prefetch:
  `tests/components/RestaurantSettingsShell.test.tsx:192`,
  `tests/components/RestaurantSettingsShell.test.tsx:208`,
  `tests/components/RestaurantSettingsShell.test.tsx:241`,
  `tests/components/RestaurantSettingsShell.test.tsx:268`.
- Embedded discovery:
  `tests/components/RestaurantBusinessContextSection.test.tsx:195`,
  `tests/components/RestaurantBusinessContextSection.test.tsx:359`.

## Browser Verification Log

Runtime:

- Existing local server on port 3000: `next-server (v16.1.6)`.
- Browser target: `http://app.localhost:3000/settings/restaurant/profile`.
- Resulting page title: `Restaurant profile · Nab a Table Ops`.
- Session state: signed in; route rendered for restaurant badge `Old Crown Girton`.

Checks performed on the real shipped app-host route:

| Check                       | Result  | Evidence                                                                                                                                                                                         |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Signed-in route load        | Pass    | URL stayed `http://app.localhost:3000/settings/restaurant/profile`; title was `Restaurant profile · Nab a Table Ops`.                                                                            |
| Subnav active state         | Pass    | `Restaurant profile` subnav link had `aria-current="page"`.                                                                                                                                      |
| Header title/description    | Pass    | H1 `Restaurant profile` and description `Public details, booking page URL, manager alerts, and optional discovery.` were visible.                                                                |
| Restaurant badge            | Pass    | Header meta showed `Editing` and `Old Crown Girton`.                                                                                                                                             |
| `#profile-identity`         | Pass    | Direct hash navigation landed on `.../profile#profile-identity`; section wrapper was visible.                                                                                                    |
| `#profile-contact`          | Pass    | Direct hash navigation landed on `.../profile#profile-contact`; section wrapper was visible.                                                                                                     |
| `#profile-booking-url`      | Pass    | Direct hash navigation landed on `.../profile#profile-booking-url`; section wrapper was visible.                                                                                                 |
| `#profile-notifications`    | Pass    | Direct hash navigation landed on `.../profile#profile-notifications`; section wrapper was visible.                                                                                               |
| `#profile-discovery`        | Pass    | Direct hash navigation landed on `.../profile#profile-discovery`; section wrapper was visible.                                                                                                   |
| Two-section dirty state     | Pass    | Filled `#restaurant-business-description` and `#restaurant-phone` without submitting; sticky bar showed `2 unsaved profile sections`.                                                            |
| `Save all` visibility       | Pass    | Sticky bar showed one `Save all` button when two form sections were dirty.                                                                                                                       |
| Per-section form targets    | Pass    | Sticky `Save brand` had `form="restaurant-profile-brand-form"`; sticky `Save contact` had `form="restaurant-profile-contact-form"`.                                                              |
| Save submission             | Not run | Read-only audit: I did not click `Save all`, `Save brand`, or `Save contact`, because those actions would submit remote `PATCH` mutations. Browser edits were discarded with reload.             |
| GBP CTA target              | Pass    | Href `/app/settings/restaurant/google-business-profile#gbp-connection`; direct target navigation reached `http://app.localhost:3000/settings/restaurant/google-business-profile#gbp-connection`. |
| Availability related target | Pass    | Href `/app/settings/restaurant/availability#booking-rules`; direct target navigation reached `http://app.localhost:3000/settings/restaurant/availability#booking-rules`.                         |
| Team related target         | Pass    | Href `/app/settings/restaurant/team`; direct target navigation reached `http://app.localhost:3000/settings/restaurant/team`.                                                                     |

Browser caveat: direct click attempts through the Browser automation surface did not produce route
navigation for the profile links, so the log records href extraction plus direct navigation to each
href target. This still verifies the rendered target contracts, but it is not evidence that a
pointer click completed client-side navigation in this Browser session.

## Not Changed

- No app, component, hook, test, API, schema, or data files were edited.
- No tests were added or changed.
- No save action or remote data mutation was performed during browser verification.
