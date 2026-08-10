# GBP Wave 3 clone / design-system fidelity review

Recommendation: **REQUEST_CHANGES**

Scope reviewed: `DESIGN.md`, current changed source, capture manifest/log, and all nine prescribed PNG captures. The reference is the existing Nabatable restaurant-settings visual language and `DESIGN.md`, not a pixel-perfect external mock.

## Evidence inspected

- `.omo/evidence/gbp-wave3-main-linked-375.png` (375 × 1400)
- `.omo/evidence/gbp-wave3-main-linked-768.png` (768 × 1400)
- `.omo/evidence/gbp-wave3-main-linked-1280.png` (1280 × 1000)
- `.omo/evidence/gbp-wave3-exact-confirmation-375.png` (375 × 1800)
- `.omo/evidence/gbp-wave3-exact-confirmation-768.png` (768 × 1600)
- `.omo/evidence/gbp-wave3-exact-confirmation-1280.png` (1280 × 1200)
- `.omo/evidence/gbp-wave3-outcome-unknown-375.png` (375 × 900)
- `.omo/evidence/gbp-wave3-outcome-unknown-768.png` (768 × 900)
- `.omo/evidence/gbp-wave3-outcome-unknown-1280.png` (1280 × 940)
- `.omo/evidence/gbp-wave3-visual-revise-captures.log`
- `src/components/features/restaurant-settings/RestaurantSettingsChromeHeader.tsx`
- `src/components/features/restaurant-settings/google-business-profile/components/GbpOperatorControls.tsx`
- `src/components/features/restaurant-settings/google-business-profile/components/GbpOperatorStateDetails.tsx`
- `src/components/features/restaurant-settings/google-business-profile/components/GbpTerminalNotices.tsx`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx`
- `src/components/features/restaurant-settings/dual-sync/hooks/useDualSyncExactPublishActions.ts`
- `tests/e2e/ops-gbp-dual-sync.spec.ts`

The PNG signatures and dimensions match their filenames. They are RGB, fully composited captures; no raster/screenshot substitute was found in the reviewed GBP components. The UI is a live React tree built from the existing `Card`, `Alert`, `Badge`, `Dialog`, `Button`, `Input`, `Label`, and `Checkbox` primitives. Reviewed Wave 3 components use semantic theme utilities rather than bespoke raw colour styling.

## Findings

### CRITICAL

None.

### HIGH

1. **[product] `outcome_unknown` is simultaneously announced as a success.** The result dialog correctly warns that an unknown provider result is never success (`GbpExactPublishResultDialog.tsx:24-62`), but the action unconditionally emits a success toast for every immediate result (`useDualSyncExactPublishActions.ts:106-112`). The contradiction is visible in both desktop/tablet outcome captures as the green toast “Google returned an immediate publish outcome.” alongside “Provider outcome unknown.” This violates the fail-stop state language and can lead an operator to misread a high-risk publish as successful. Emit a warning/error/info outcome for `outcome_unknown`, and reserve success for an actual fully-consumed success result.

2. **[evidence] The 375 exact-confirmation capture does not visibly prove the FoodMenus warning or either required acknowledgement.** The screenshot ends after the heading of the FoodMenus group; the warning, its before/after values, acknowledgement, and publish controls are outside the internally-scrollable dialog. The small-screen capture is therefore incomplete for the stated state contract, despite source proving that the DOM contains these controls (`GbpExactPublishDialog.tsx:155-238`). Record a settled narrow capture after scrolling the dialog to the FoodMenus warning/acknowledgement (or a defined, equivalent multi-frame evidence sequence) so all required 375px content is directly reviewable.

3. **[evidence] The 375 `outcome_unknown` capture is taken in an in-flight/visually contaminated state.** Underlying page text visibly bleeds through/overlaps the upper portion of the dialog in `gbp-wave3-outcome-unknown-375.png`; its visual layering cannot be accepted as a settled dialog presentation. The capture helper in `tests/e2e/ops-gbp-dual-sync.spec.ts:618-634` captures immediately after visibility assertions and does not wait for dialog animation to settle. Capture a settled frame after the transition and verify the opaque dialog surface at 375px.

### MEDIUM

1. **[evidence] The outcome captures contain a green success toast even though the represented state is uncertain.** This is both visual evidence of the HIGH product contradiction and makes the state screenshot misleading. It must disappear or become a non-success uncertainty notice before outcome evidence is accepted.

2. **[evidence] The capture manifest is malformed at its beginning** (`gbp-wave3-visual-revise-captures.log:1` begins with control characters `^D`/backspaces). The individual file checks are readable, but the log is not a clean reproducible record. Regenerate it cleanly with capture timestamps and the settled-state check.

### LOW

None.

## What is good

- Main linked state is a restrained continuation of the restaurant-settings command-centre: compact shadcn cards, semantic badges/alerts, no bespoke shadows, and responsive one/two-column metadata.
- At 375px the restaurant badge is hidden, review status remains compact, and the title is a usable truncated line rather than a one-character column. The 768px and 1280px headers preserve the normal expanded context.
- The live DOM source provides separate state cards and a real password input, labels, buttons, alerts, and badges; no fake screenshot/background-image implementation was found.
- The exact-confirmation dialog has real listing/version/expiry/mask/before-after/warning/acknowledgement structure, with a distinct FoodMenus replacement acknowledgement (`GbpExactPublishDialog.tsx:113-238`). Tablet and desktop captures make all of this legible.
- The visible dialog outcome guidance correctly instructs a refresh, listing verification, a new preview, and operational-channel verification (`GbpExactPublishResultDialog.tsx:54-62`); the main-page operational notice repeats the same state safely.

## Blocking list

1. Remove the success treatment for immediate responses containing `outcome_unknown`.
2. Provide settled 375px evidence that visibly covers the FoodMenus replacement warning and acknowledgement in the exact-confirmation state.
3. Re-capture the 375px outcome dialog after transition completion with correct opaque compositing, and regenerate the malformed capture log.
