# Continuity Ledger

Last updated: 2026-05-18T15:20:00Z

## Goal (incl. success criteria)

- Execute the restaurant settings refactor plan, now through Phase 10 cleanup/redesign gate.
- Success for the current slice: the deprecated route-local email templates section is removed only after redirect proof, post-refactor profile analysis artifacts are current, redesign remains out of scope, and verification is recorded truthfully.

## Constraints/Assumptions

- Medium-risk ops app-host work; use `tasks/restaurant-settings-refactor-20260518-1306/`.
- Behavior-preserving only: no copy, visual, className, route, auth, proxy, Supabase, schema, or `components/ui/**` changes.
- Worktree was already dirty before this Phase 0 pass, including overlapping profile settings files and unrelated auth/proxy/test files.
- Browser proof should use the shipped app-host profile route; record auth-boundary proof if authenticated proof is blocked.

## Key decisions

- Start with Phase 0 only, not the full multi-phase refactor.
- Keep helper extraction local to `src/components/features/restaurant-settings/**`.
- Treat `SettingsSectionStates` as an additive shared helper first; broad consumer wiring can happen only when behavior remains clearly unchanged.

## State

- Phase 0 implementation complete.
- Phase 1a hook extraction complete.
- Phase 1b view decomposition complete; `RestaurantProfileSection.tsx` is now 244 lines.
- Phase 2a discovery chrome/frame extraction complete; `RestaurantBusinessContextPanels.tsx` is now 1000 lines.
- Phase 2b discovery panel split complete; `RestaurantBusinessContextPanels.tsx` is now a 9-line compatibility barrel and panel files live under `discovery/panels/`.
- Phase 2c discovery section slim-down complete; `RestaurantBusinessContextSection.tsx` is now 249 lines.
- Phase 3 GBP/drift compare consolidation complete; `gbp/openSettingsCompare.ts` owns typed profile/global/field/discovery-family presets.
- Phase 4 settings shell and overview extraction complete; `shared/RestaurantSettingsCommandCenter.tsx` is now 157 lines, `shared/SettingsSectionNav.tsx` owns the nav, and overview card construction lives in `overview/buildSetupCards.ts`.
- Phase 5 Google Business Profile route split complete; `GoogleBusinessProfileSection.tsx` is now 466 lines and section/helper files live under `google-business-profile/sections/` plus `googleBusinessProfileWorkflow.ts`.
- Phase 6a availability command-center extraction complete; `AvailabilityOccasionsCommandCenter.tsx` is now 77 lines and route-local helpers live under `availability/`.
- Phase 6b availability schedule manager render extraction complete; `AvailabilityScheduleManager.tsx` keeps state/save orchestration and extracted render modules live under `availability/`.
- Phase 6c availability schedule day-card extraction complete; `ScheduleDayCard.tsx` is 268 lines and `ScheduleMealWindowEditor.tsx` is 90 lines under `availability/`.
- Phase 7 dual-sync extraction complete; `DualSyncShell.tsx` is now 812 lines, `dual-sync/hooks/useDualSyncWorkspace.ts` owns workspace state/filtering, and panel files are grouped under `dual-sync/panels/`.
- Phase 8 cross-route boundary complete as no-source-change implementation: menu, tables, and team already mount through `OpsRestaurantSettingsClient` and shared command-center chrome; only a responsive-nav test assertion was corrected.
- Phase 9 RestaurantDetailsForm split complete; `components/ops/restaurants/RestaurantDetailsForm.tsx` is now a 16-line compatibility barrel, exported subforms live under `components/ops/restaurants/details/`, and the full-form implementation moved to `details/RestaurantDetailsForm.tsx`.
- Phase 10 cleanup complete; `src/components/features/restaurant-settings/EmailTemplatesSection.tsx` was removed after proving the shipped settings route redirects to `/app/email-templates`, `analysis/profile-status-bar-consolidated.json` was refreshed, and the stale all-routes analysis snapshot no longer embeds the removed component.
- Focused static/unit/browser verification passed.

## Done

- Read Nabatable SDLC docs, role contracts, task-harness guidance, and relevant component AGENTS files.
- Created `tasks/restaurant-settings-refactor-20260518-1306/` with `research.md`, `plan.md`, `todo.md`, and `verification.md`.
- Added shared/profile/GBP Phase 0 helpers, removed scanned-unused `ProfileSectionShell` and `DiscoverySheet`, and updated `RestaurantProfileSection` to consume extracted helpers.
- Passed targeted eslint, focused profile Vitest, Prettier check, typecheck, in-app browser auth-boundary proof, and authenticated app-host Playwright proof.
- Added `profile/hooks/useProfileDraftState`, `useProfileSectionNav`, `useProfileReadiness`, `useProfileEditorAnalytics`, and `useProfileGbpDraftOverrides`.
- Reran targeted eslint, focused profile Vitest, typecheck, Prettier check, app-host Playwright proof, and `git diff --check` for Phase 1a.
- Added `profile/ProfileShell.tsx`, `profile/ProfileSectionBody.tsx`, and `profile/ProfileLoadedView.tsx`.
- Reran targeted eslint, focused profile Vitest, typecheck, Prettier check, app-host Playwright proof, and `git diff --check` for Phase 1b.
- Added `discovery/DiscoveryPanelChrome.tsx` and `discovery/DiscoveryPanelsFrame.tsx`.
- Reran targeted eslint, discovery/profile Vitest, typecheck, Prettier check, app-host Playwright proof, and `git diff --check` for Phase 2a.
- Added `discovery/panels/` files for business details, links, categories, service areas, attributes, and service items.
- Rewired `RestaurantBusinessContextSection` to import panels from `discovery/panels` while keeping `RestaurantBusinessContextPanels.tsx` as a barrel.
- Reran targeted eslint, discovery/profile Vitest, typecheck, Prettier check, app-host Playwright proof, and `git diff --check` for Phase 2b.
- Added `discovery/hooks/useDiscoveryGbpDraftOverrides.ts` and `discovery/discoverySummary.ts`.
- Rewired `RestaurantBusinessContextSection` to use `SettingsSectionStates` for no-restaurant/loading/error branches.
- Reran targeted eslint, discovery/profile Vitest, typecheck, Prettier check, app-host Playwright proof, and `git diff --check` for Phase 2c.
- Added `gbp/openSettingsCompare.ts` and `tests/components/openSettingsCompare.test.ts`.
- Rewired profile workspace compare, global status-strip compare, field badge compare, and GBP page quick compare to typed settings compare presets.
- Documented Phase 3 strip/status-bar behavior as unchanged: shell `GbpDriftStatusStrip` stays global, profile status bar hint stays profile-specific.
- Reran targeted eslint, GBP/profile/discovery Vitest, typecheck, Prettier check, app-host Playwright proof, and `git diff --check` for Phase 3.
- Added `shell/useRestaurantSettingsContext.ts` and rewired the settings page shell, chrome header, `OpsRestaurantSettingsClient`, GBP drift facade, and setup overview to consume it.
- Split `SettingsSectionNav` out of `shared/RestaurantSettingsCommandCenter.tsx` into `shared/SettingsSectionNav.tsx`.
- Moved overview rendering to `overview/RestaurantSetupOverview.tsx`, kept the old `RestaurantSetupOverview.tsx` path as a re-export, and extracted pure setup card construction to `overview/buildSetupCards.ts`.
- Reran targeted eslint, setup/shell/profile/GBP Vitest, typecheck, Prettier check, command-center Playwright proof, app-host profile Playwright proof, and `git diff --check` for Phase 4.
- Added `google-business-profile/googleBusinessProfileWorkflow.ts` and section modules for workflow frame, connection, location picker, route state cards, persistent error alert, and linked/sync summary.
- Rewired `GoogleBusinessProfileSection.tsx` to use `SettingsSectionStates` for no-restaurant/loading/error branches while preserving the existing rendered states.
- Fixed the moved GBP footer markup from nested divs inside `SettingsSectionNav`'s paragraph wrapper to equivalent span phrasing content, removing the React invalid-nesting warning in the focused GBP test.
- Reran targeted eslint, GBP/drift/settings-shell Vitest, typecheck, Prettier check, GBP dual-sync Playwright proof, and `git diff --check` for Phase 5.
- Added `availability/types.ts`, `availability/bookingRulesModel.ts`, `availability/BookingRulesCard.tsx`, `availability/AvailabilityWorkspaceNav.tsx`, and `availability/AvailabilityWorkspacePanels.tsx`.
- Rewired `AvailabilityOccasionsCommandCenter.tsx` to compose the extracted availability workspace nav and panels while preserving anchors and alias-driven initial workspaces.
- Reran targeted eslint, availability/settings-shell Vitest, typecheck, Prettier check, availability alias-route Playwright proof, and `git diff --check` for Phase 6a.
- Added `availability/AvailabilityScheduleStates.tsx`, `availability/ScheduleWorkspace.tsx`, and `availability/BookingTypesWorkspace.tsx`.
- Rewired `AvailabilityScheduleManager.tsx` to compose the extracted render modules while preserving anchors, copy, classNames, GBP drift badges, validation, save/reset controls, and mutation ownership.
- Reran targeted eslint, availability/settings-shell Vitest, typecheck, Prettier check, availability alias-route Playwright proof, and `git diff --check` for Phase 6b.
- Moved `AvailabilityScheduleDayCard.tsx` into `availability/ScheduleDayCard.tsx` and extracted `availability/ScheduleMealWindowEditor.tsx`.
- Rewired `ScheduleWorkspace.tsx` to use the availability-local day card while preserving the day-card props, field ids, copy, classNames, and drift badge behavior.
- Reran targeted eslint, availability/settings-shell Vitest, typecheck, Prettier check, availability alias-route Playwright proof, and `git diff --check` for Phase 6c.
- Added `dual-sync/hooks/useDualSyncWorkspace.ts` for section filtering, accordion state, panel lazy-load toggles, selected publish job, and field decision state.
- Moved dual-sync panels into `panels/health/`, `panels/jobs/`, and `panels/operations/`, and updated focused panel tests to the new import paths.
- Rewired `DualSyncShell.tsx` to consume the hook and moved panels while preserving panel order, lazy query behavior, decisions, publish preview, and publish result behavior.
- Reran targeted eslint, dual-sync Vitest, typecheck, Prettier check, GBP dual-sync Playwright proof, and `git diff --check` for Phase 7.
- Audited menu/tables/team settings routes and confirmed they already use `OpsRestaurantSettingsClient` and shared command-center chrome.
- Updated `OpsMenuManagementClient.test.tsx` to accept the existing responsive desktop/mobile `Menu catalogues` navigation pair instead of assuming a single nav.
- Reran menu/table/team/settings-shell Vitest, typecheck, Prettier check, menu/team/tables app-host Playwright proof, and `git diff --check` for Phase 8.
- Split `components/ops/restaurants/RestaurantDetailsForm.tsx` into a compatibility barrel plus `components/ops/restaurants/details/` modules for the full form, brand identity, contact/location, manager notifications, advanced identity, booking rules, shared helpers, and index exports.
- Preserved the old import path for profile, availability booking rules, edit dialog, and tests.
- Reran targeted eslint, form/profile/availability Vitest, typecheck, Prettier check, profile app-host Playwright proof, availability alias-route Playwright proof, and `git diff --check` for Phase 9.
- Removed the unreferenced `src/components/features/restaurant-settings/EmailTemplatesSection.tsx`.
- Refreshed `analysis/profile-status-bar-consolidated.json` from the current post-refactor profile modules and removed the deleted component from `analysis/restaurant-settings-consolidated/all-routes.json`.
- Reran no-reference search, typecheck, `ProfileStatusBar` Vitest, app-host email-template redirect Playwright proof, Prettier check, and `git diff --check` for Phase 10.

## Now

- Phase 10 is handed off; the restaurant settings refactor plan is implemented and verified through the planned cleanup gate.

## Next

- If continuing, move into separate redesign PRs per component rather than expanding this behavior-preserving refactor.

## Open questions (UNCONFIRMED if needed)

- UNCONFIRMED: whether the existing overlapping profile visual/hash edits are user-authored or generated by a prior agent; preserve them unless they block Phase 0.

## Working set (files/ids/commands)

- `tasks/restaurant-settings-refactor-20260518-1306/**`
- `src/components/features/restaurant-settings/RestaurantProfileSection.tsx`
- `src/components/features/restaurant-settings/profile/**`
- `src/components/features/restaurant-settings/discovery/**`
- `src/components/features/restaurant-settings/RestaurantBusinessContextPanels.tsx`
- `src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx`
- `src/components/features/restaurant-settings/availability/**`
- `src/components/features/restaurant-settings/gbp/**`
- `src/components/features/restaurant-settings/google-business-profile/**`
- `src/components/features/restaurant-settings/overview/**`
- `src/components/features/restaurant-settings/shell/**`
- `src/components/features/restaurant-settings/shared/**`
- `components/ops/restaurants/RestaurantDetailsForm.tsx`
- `components/ops/restaurants/details/**`
- `analysis/profile-status-bar-consolidated.json`
- `analysis/restaurant-settings-consolidated/all-routes.json`
- `tests/components/RestaurantProfileSection.test.tsx`
- `tests/components/RestaurantBusinessContextSection.test.tsx`
