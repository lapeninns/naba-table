# GBP Wave 3 functional gate

## recommendation

APPROVE

## blockers

None.

## originalIntent

Ship the authenticated Google Business Profile settings/operator experience without weakening the frozen safety model: a strict canonical V1 state endpoint alongside a separate rich-details endpoint; admin and password gates; explicit write and notification controls; fail-stop pending-update handling; exact, expiring one-shot preview/confirmation; destructive FoodMenus acknowledgement; truthful queued/immediate/unknown outcomes and terminal notices; volatile client-cache cleanup; private no-store responses and safe errors; and preservation of the existing connect, location-link, and disconnect journeys.

## desiredOutcome

An administrator can inspect current GBP safety state and pending masks, password-confirm write/notification changes, preview exactly what will be written, acknowledge external/destructive effects, publish once within a maximum 15-minute approval window, and receive truthful terminal recovery guidance. Non-admins and stale/unknown states cannot cross the server write boundary. Existing GBP connection management continues to use the rich DTO from a distinct endpoint.

## userOutcomeReview

The shipped artifact satisfies the Wave 3 outcome. The canonical `GET /google-business-profile` producer emits the strict V1 operator state, while the existing browser connection client now reads the rich legacy DTO from `/google-business-profile/details`. Operator controls are hidden without `canManageSettings`, and every relevant producer uses restaurant-admin authorization; write eligibility, notification participation, and disconnect additionally verify a password. Pending masks are a strict `none | known | unknown` union, with unknown paths rendered as a destructive fail-stop notice. Exact previews strictly bind listing/fence identifiers, snapshot pins, groups, masks, before/after displays and hashes, fingerprint, versions, warnings, and a window no longer than 15 minutes; expired previews are rejected by the client parser and server workflow and the dialog offers refresh plus re-preview. Full-replacement FoodMenus groups require their own acknowledgement before confirmation. Publish results distinguish queued from immediate results and do not style or toast `outcome_unknown` as success; provider and operational recovery instructions remain visible through terminal notices. GBP operator queries are non-persistent, use zero GC time, and are explicitly removed on hook cleanup/restaurant change, write revocation, location relink, and disconnect. Reviewed success and error paths apply private no-store headers and return safe public failures.

The existing connect, authorized-location picker, linked state, password-confirmed disconnect, unconfigured credentials, and reconnect journeys remain covered by the focused component and shipped-route browser evidence.

## reproducedEvidence

- `./node_modules/.bin/vitest run` over 15 Wave 3 contract/client/hook/component/route files: **15 files passed, 98 tests passed**, 2026-08-09 22:22 Europe/London.
- `./node_modules/.bin/tsc --noEmit`: **exit 0**.
- Direct source tracing confirmed canonical/details endpoint separation, admin/password route gates, strict Zod boundaries, exact-preview expiry parsing, result truthfulness, query cleanup, and no-store response wrappers.

## checkedArtifactPaths

- `.omo/plans/google-business-profile-remediation.md`
- `.omo/evidence/gbp-wave3-ui-doneclaim.json`
- `.omo/evidence/gbp-wave3-api-producers-doneclaim.json`
- `.omo/evidence/gbp-wave3-client-contracts.json`
- `.omo/evidence/gbp-wave3-correction.json`
- `.omo/evidence/gbp-wave3-ui-focused-final.log`
- `.omo/evidence/gbp-wave3-api-final-integration.log`
- `.omo/evidence/gbp-wave3-visual-revise-playwright.log`
- `.omo/evidence/gbp-wave3-clone-fidelity.md`
- `server/dual-sync/contracts/operator-state.ts`
- `server/dual-sync/contracts/exact-api.ts`
- `src/services/ops/dual-sync.ts`
- `src/services/ops/restaurants.ts`
- `src/hooks/ops/opsIntegrationQueries.ts`
- `src/hooks/ops/useOpsGoogleBusinessProfile.ts`
- `src/components/features/restaurant-settings/google-business-profile/**`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx`
- `src/components/features/restaurant-settings/dual-sync/hooks/useDualSyncExactPublishActions.ts`
- `src/app/api/ops/restaurants/[id]/google-business-profile/{route.ts,details/route.ts,write-access/route.ts,notifications/route.ts}`
- `src/app/api/ops/restaurants/[id]/dual-sync/publish/{route.ts,preview/route.ts}`
- The 15 reproduced test files named by the gate command in this report.

## slopAndProgrammingPass

Direct `remove-ai-slops` and `programming` review found no criterion-breaking overfit, tautological deletion-only test, raw-provider leakage, untyped production escape hatch, or unnecessary Wave 3 abstraction. The tests assert machine-consumed contracts and observable UI/route behavior rather than merely checking that removed code is absent. Route tests use mocks at external/database/auth seams, but the independent contract, component, and browser artifacts prevent those mocks from being the sole evidence.

NOTE (non-blocking): `src/hooks/ops/useOpsDualSync.ts` is over the programming skill's 250-pure-LOC preference, and the exact-dialog expiry display updates on render rather than a timer. Neither violates a stated Wave 3 success criterion: live publish is independently re-parsed against the current clock and server-fenced, so an elapsed preview cannot execute. These are maintenance/UX follow-ups, not gate blockers.

## exactEvidenceGaps

- No final code-review report artifact was provided that explicitly records its own `programming` plus overfit/slop coverage. Per gate policy, this is not a blocker because the direct pass above and inspected evidence support completion.
- The focused hook tests assert the removal helper and disconnect invalidation, while the unmount/switch cleanup effect itself is established primarily by direct source inspection (`useEffect` cleanup keyed by `restaurantId`) plus `gcTime: 0`; there is no dedicated lifecycle render-hook assertion in the inspected Wave 3 test set. This is a coverage note, not evidence of a failed criterion.
- External staging/Google/Supabase release gates remain outside Wave 3 and are explicitly deferred by the plan; no live provider mutation was required or performed.
