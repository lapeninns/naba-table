# GBP Wave 3 post-repair visual gate B

## recommendation

**REVISE**

## blockers

1. **VIS-RESP-375 — normal-height exact-confirmation evidence must show an unclipped steady initial state.** `gbp-wave3-exact-confirmation-375-initial.png` visibly captures the dialog horizontally displaced beyond the left viewport edge: the title, listing facts, fingerprint, timestamps, and first change group are cut off. The later scrolled capture is correctly centered, so this is most likely a screenshot taken during the 200 ms Radix entrance animation rather than a settled product-layout defect. Nevertheless, the required initial normal-height evidence does not prove “no clipping/collisions at 375.” Re-capture the 375x812 initial state after the dialog animation settles and add a dialog bounding-box assertion (`x >= 0`, `x + width <= 375`) before capture.
   - `violatedCriterion`: `VIS-RESP-375`
   - `evidencePointer`: `.omo/evidence/gbp-wave3-exact-confirmation-375-initial.png`; `components/ui/dialog.tsx:44-48`; `tests/e2e/ops-gbp-dual-sync.spec.ts:606-630`

## originalIntent

Deliver a safe, truthful Google Business Profile operator flow that remains usable and legible at 375, 768, and 1280 pixels: exact consent must expose the listing and write facts, destructive FoodMenus replacement must require its own acknowledgement, unknown provider outcomes must never appear successful, and long dialogs must remain keyboard-operable with bounded internal scrolling.

## desiredOutcome

Fresh capture and E2E evidence should show the linked/operator state, exact-confirmation state, and `outcome_unknown` state with no clipped or colliding content at all target widths. At 375x812 the exact dialog must open centered, demonstrate genuine internal overflow, allow keyboard navigation, expose the FoodMenus acknowledgement and publish control after scrolling, close with Escape, and restore focus.

## userOutcomeReview

The two previously reported product defects are repaired. In the regenerated 375px main capture, `Review changes` wraps into a fully legible workflow row and remains inside the viewport. In the regenerated 375px outcome capture, reserved header space keeps the circular close control clear of the full safety sentence; there is no text overlap. The 768px and 1280px main/outcome captures are also clean.

The exact-consent content is complete in the settled tall captures: listing location, account/profile, connection generation and consent epoch, confirmation/policy/renderer versions, fingerprint, issued and <=15-minute expiry, PATCH method, resources, update masks, before/after values, warnings, general external-write acknowledgement, and the separate full-replacement FoodMenus acknowledgement are present. The FoodMenus resource and `menus` mask are shown. `Publish exact plan` remains disabled before acknowledgement.

Truthfulness passes. The immediate result is labeled `outcome_unknown` / `provider_outcome_unknown`, says queued is not complete and unknown is never success, directs the operator to refresh state, verify the listing, create a new preview, and verify the operational notification channel, and the E2E asserts zero success toasts.

The prior evidence gaps are substantively repaired in the browser scenario. At 375x812 the test asserts `scrollHeight > clientHeight`, initial `scrollTop === 0`, reaches the destructive acknowledgement and publish action after scrolling, checks initial title focus, Tab/Shift+Tab focus containment, Escape close, focus restoration to the publish trigger, and focus on reopened dialog. The green Playwright log reports all five shipped-route scenarios passing. The remaining blocker is the visibly unsettled/clipped initial PNG, not missing E2E behavior.

## responsive matrix

| State                                      | 375                                                              | 768  | 1280 |
| ------------------------------------------ | ---------------------------------------------------------------- | ---- | ---- |
| Main linked/operator                       | PASS — workflow step repaired, no collision                      | PASS | PASS |
| Exact confirmation, settled/tall           | PASS — complete contents and acknowledgements                    | PASS | PASS |
| Exact confirmation, normal-height initial  | **REVISE — capture clipped during apparent entrance transition** | N/A  | N/A  |
| Exact confirmation, normal-height scrolled | PASS — centered, FoodMenus ack and actions reachable             | N/A  | N/A  |
| `outcome_unknown`                          | PASS — close collision repaired, no false success                | PASS | PASS |

## artifact integrity and freshness

All 11 requested files have valid PNG signatures and non-zero sizes. Their widths match their filenames. Dimensions are:

- main linked: 375x1400, 768x1400, 1280x1000
- exact confirmation: 375x2600, 768x1600, 1280x1200
- outcome unknown: 375x900, 768x900, 1280x940
- normal-height exact confirmation: 375x812 initial and 375x812 scrolled

The files were regenerated at 2026-08-09 22:34:27–22:34:34 BST, after the relevant repairs (`GbpExactPublishResultDialog.tsx` and `GbpWorkflowFrame.tsx` at 22:30, E2E at 22:32, and `GbpExactPublishDialog.tsx` at 22:33). `.omo/evidence/gbp-wave3-visual-revise-captures.log` records dimensions, timestamps, SHA-256 hashes, and the expected PNG signature for all 11 files.

## programming and remove-ai-slops pass

Direct review of the repaired source and E2E found no criterion-breaking untyped escape hatch, unnecessary production abstraction, deletion-only assertion, tautological test, or test that merely mirrors a requested removal. The responsive assertions exercise observable bounding boxes; the focus/scroll assertions exercise browser behavior; and the outcome test validates the user-visible safety state plus absence of success toasts. The `captureState` helper is justified by three states across three widths and is not speculative extraction.

NOTE: the initial-dialog screenshot is captured immediately after visibility/focus assertions while the shared dialog carries a 200 ms animated entrance. Adding a deterministic settled-state wait and bounding-box assertion is evidence hardening, not a production redesign.

## checked artifact paths

- `DESIGN.md`
- `components/ui/dialog.tsx`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx`
- `src/components/features/restaurant-settings/dual-sync/hooks/useDualSyncExactPublishActions.ts`
- `src/components/features/restaurant-settings/google-business-profile/sections/GbpWorkflowFrame.tsx`
- `tests/e2e/ops-gbp-dual-sync.spec.ts`
- `.omo/evidence/gbp-wave3-visual-revise-playwright.log`
- `.omo/evidence/gbp-wave3-visual-revise-captures.log`
- `.omo/evidence/gbp-wave3-functional-gate.md`
- `.omo/evidence/gbp-wave3-visual-final-a.md`
- `.omo/evidence/gbp-wave3-visual-final-b.md`
- all 11 requested `gbp-wave3-{main-linked,exact-confirmation,outcome-unknown}*.png` files

## exact evidence gaps

- Missing a settled, unclipped 375x812 initial exact-confirmation PNG. The current initial file is visibly mid-transition or otherwise displaced.
- The test does not currently assert the dialog's horizontal bounding box before the initial normal-height capture; therefore a clipped capture can coexist with a green E2E run.

## re-review condition

Re-run the shipped-route browser scenario after waiting for the dialog entrance transition to settle, assert the dialog bounding box is entirely inside the 375px viewport, and regenerate at least `gbp-wave3-exact-confirmation-375-initial.png` plus the capture-integrity log. No production UI change is indicated unless the settled assertion fails.
