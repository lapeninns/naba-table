# GBP Wave 3 post-repair visual / clone-fidelity review A

**Verdict:** REVISE  
**Recommendation:** REQUEST_CHANGES

## Scope and target

This is an independent post-repair review of the existing Nabatable restaurant-settings
language and `DESIGN.md`, which are the visual contract (no separate pixel-perfect
external reference was supplied). I directly opened every supplied capture at original
resolution and traced the live React implementation; earlier success reports were not
treated as proof.

## Evidence inspected

- `DESIGN.md`
- `.omo/evidence/gbp-wave3-main-linked-375.png` (375 x 1400)
- `.omo/evidence/gbp-wave3-main-linked-768.png` (768 x 1400)
- `.omo/evidence/gbp-wave3-main-linked-1280.png` (1280 x 1000)
- `.omo/evidence/gbp-wave3-exact-confirmation-375.png` (375 x 2600)
- `.omo/evidence/gbp-wave3-exact-confirmation-768.png` (768 x 1600)
- `.omo/evidence/gbp-wave3-exact-confirmation-1280.png` (1280 x 1200)
- `.omo/evidence/gbp-wave3-outcome-unknown-375.png` (375 x 900)
- `.omo/evidence/gbp-wave3-outcome-unknown-768.png` (768 x 900)
- `.omo/evidence/gbp-wave3-outcome-unknown-1280.png` (1280 x 940)
- `.omo/evidence/gbp-wave3-exact-confirmation-375-initial.png` (375 x 812)
- `.omo/evidence/gbp-wave3-exact-confirmation-375-scrolled.png` (375 x 812)
- `.omo/evidence/gbp-wave3-visual-revise-captures.log`
- `components/ui/dialog.tsx:36-100`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx:47-258`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx:15-99`
- `src/components/features/restaurant-settings/dual-sync/hooks/useDualSyncExactPublishActions.ts:66-160`
- `src/components/features/restaurant-settings/google-business-profile/{GoogleBusinessProfileSection.tsx:87-99,components/GbpOperatorControls.tsx:73-148,components/GbpOperatorStateDetails.tsx:27-90,components/GbpTerminalNotices.tsx:6-42,sections/GbpWorkflowFrame.tsx:76-168}`
- `src/components/features/restaurant-settings/shared/{RestaurantSettingsCommandCenter.tsx:66-156,SettingsSectionNav.tsx:183-240}`
- `tests/e2e/ops-gbp-dual-sync.spec.ts:560-649`

All eleven images have the correct PNG signature and dimensions named in the manifest.
Their 22:34 capture timestamps are newer than the latest reviewed UI-source changes;
the manifest has valid SHA-256 records and no malformed prefix.

## Findings

### CRITICAL

None. The audited feature is a live React tree. It uses the shared `Dialog`, `Card`,
`Alert`, `Badge`, `Button`, `Checkbox`, `Input`, and `Label` primitives; no reviewed
GBP component substitutes a raster, canvas, data URI, or `background-image` for the UI.

### HIGH

1. **[evidence] The 375 x 812 initial exact-confirmation frame is invalid as final
   responsive evidence.** It visibly captures the dialog during its opening horizontal
   transition: the dialog is displaced past the left viewport edge, its initial title
   and listing metadata are clipped, the background shows through, and the close
   control is off-frame. This directly fails the requested normal-phone initial-state
   proof. The shared primitive applies a 200ms animated slide (`components/ui/dialog.tsx:45`),
   while the e2e flow screenshots immediately after visibility/scroll checks without
   waiting for a settled state or asserting horizontal bounds
   (`tests/e2e/ops-gbp-dual-sync.spec.ts:621-630`).

   Required fix: wait for the dialog's open animation to settle, then assert the dialog
   is within `0..375`, that its close control is in the viewport, and that no horizontal
   scroll/overflow is present before replacing this frame and manifest entry. This is
   an evidence/test defect; the settled 375 x 2600, 768, and 1280 confirmation captures
   do not independently prove an enduring layout failure.

### MEDIUM

1. **[product] The exact-confirmation heading has no narrow-screen right-side reserve
   for the shared 44px absolute close button.** The full settled 375 capture shows the
   focused heading's right edge meeting the close affordance. The text remains largely
   readable, but the safety-critical dialog title should not rely on an incidental gap.
   Unlike the repaired outcome dialog (`GbpExactPublishResultDialog.tsx:30-38`), the
   exact dialog uses a bare header (`GbpExactPublishDialog.tsx:104-111`). Reserve the
   same mobile header clearance so the title's focus treatment and close target never
   compete.

2. **[evidence] The mobile proof does not test horizontal containment.** It tests
   vertical `scrollTop`, focus order, and lower-control reachability, but not
   `scrollLeft`, `scrollWidth <= clientWidth`, dialog bounds, or close-button bounds
   (`tests/e2e/ops-gbp-dual-sync.spec.ts:621-648`). The invalid initial frame exposes
   this gap. Add those assertions with the settled-state wait.

### LOW

None.

## Verified repairs and good qualities

- **Mobile workflow:** the 375 main capture now shows the full `Review changes` step
  and its `Next` badge within the viewport. The route-level wrap override in
  `GbpWorkflowFrame.tsx:145` is live and matches the capture.
- **Outcome safety and close clearance:** all outcome captures are opaque and settled.
  At 375px the title/description clears the close target via the `pr-12 sm:pr-0`
  header in `GbpExactPublishResultDialog.tsx:30-38`. The unknown path is consistently
  warning/pending, directs refresh + listing verification + new preview, and names
  operational-channel verification (`GbpExactPublishResultDialog.tsx:24-84` and
  `useDualSyncExactPublishActions.ts:106-123`). No success toast or success treatment
  appears in any outcome capture.
- **Bounded modal scroll:** `GbpExactPublishDialog.tsx:89-103` applies a bounded,
  internally-scrollable dialog. The settled 375 x 812 scrolled frame visibly reaches
  the FoodMenus replacement warning, both acknowledgements, disabled publish action,
  and Cancel; the e2e test also asserts `scrollHeight > clientHeight` and lower-control
  reachability (`tests/e2e/ops-gbp-dual-sync.spec.ts:621-648`).
- **Exact-confirmation truth:** settled captures show listing/account identity,
  connection generation and consent epoch, versions, fingerprint, issue/expiry,
  method/resource/masks, before/after values, warnings, and separate destructive
  acknowledgement. The component renders these from the preview model rather than
  a static mock (`GbpExactPublishDialog.tsx:113-240`).
- **Design-system fidelity:** reviewed GBP code uses semantic theme and shadcn utility
  tokens, responsive grids, and existing primitives, in line with `DESIGN.md:7-35`.
  There are no raw colour values or isolated bitmap-like constructions in the scoped
  implementation. Main operator cards remain legible at 375/768/1280.

## Blockers before approval

1. Regenerate `gbp-wave3-exact-confirmation-375-initial.png` as a settled, fully
   in-viewport 375 x 812 initial state and update its manifest record.
2. Add the accompanying horizontal-containment and close-control bounds assertions.
3. Reserve close-button clearance in the exact-confirmation mobile header.

## Conclusion

The original outcome-close, workflow-legibility, outcome-truth, and vertical
modal-scroll blockers are fixed in the shipped implementation and captures. Approval
is withheld because the new normal-height initial confirmation capture is visibly
in-flight/left-clipped and therefore cannot serve as final responsive fidelity proof.
