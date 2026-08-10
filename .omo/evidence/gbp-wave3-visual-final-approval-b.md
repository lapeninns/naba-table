# GBP Wave 3 final visual approval B

## Recommendation

**REVISE**

## Original intent

Ship a responsive Google Business Profile operator flow whose linked state, exact-publish confirmation, and truthful `outcome_unknown` result are legible and operable at 375, 768, and 1280 pixels. The 375 x 812 exact dialog must settle wholly inside the viewport, scroll internally to both acknowledgements and the publish action, preserve keyboard focus behavior, and avoid close-button or workflow-label collisions.

## Desired outcome

All 11 fresh captures should show unclipped responsive layouts. Browser evidence should independently prove the bounded mobile dialog, internal scrolling, focus entry/containment/restoration, reachable destructive acknowledgement and publish control, and the absence of false success.

## User outcome review

Most of the corrected outcome is now demonstrated. The 375 x 812 dialog is settled fully within the viewport, its scroll height exceeds its client height, the scrolled capture reaches both acknowledgements and both footer actions, and the browser test proves title focus, Tab/Shift+Tab containment, Escape close, trigger focus restoration, and title focus after keyboard reopen. `Review changes` is fully visible at 375px. The `outcome_unknown` dialog reserves space for its close button, shows recovery instructions, and contains no success treatment.

Approval is still blocked by one visible mobile collision: in `gbp-wave3-exact-confirmation-375-initial.png`, the 44px circular close control overlays the end of the title `Confirm exact Google publish`. The crop at original resolution shows the final word extending beneath the control; the component's `DialogHeader` has no mobile right padding, unlike the repaired result dialog (`pr-12 sm:pr-0`). This fails the explicit no-close-overlap requirement even though the title remains mostly decipherable.

## Blockers

1. **violatedCriterion: VIS-375-NO-CLOSE-OVERLAP**  
   **Observation:** The exact-confirmation close control intrudes into the final word of the title at 375 x 812.  
   **evidencePointer:** `.omo/evidence/gbp-wave3-exact-confirmation-375-initial.png`; `src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx:104-111`; compare the reserved header space in `src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx:31`.

## Verified criteria

- **VIS-375-SETTLED-IN-VIEWPORT: PASS.** The initial dialog bounds are asserted within 375 x 812 after descendant animations settle; the screenshot shows the complete dialog shell from top edge to bottom edge.
- **VIS-375-INTERNAL-SCROLL: PASS.** The test asserts `scrollHeight > clientHeight`, initial `scrollTop === 0`, scrolls the dialog element itself to its bottom, and asserts the FoodMenus acknowledgement and `Publish exact plan` are in the viewport. Initial and scrolled screenshots visibly differ and independently show the top and bottom states.
- **VIS-FOCUS: PASS.** The shipped-route test asserts initial title focus; Tab to the first acknowledgement; Shift+Tab to Close; Tab back into content; Escape closes; focus returns to the publish trigger; Enter reopens; and title focus is restored.
- **VIS-REVIEW-CHANGES: PASS.** At 375px, `Review changes` is fully visible in the regenerated main capture. Bounding-box assertions prove its right edge is at or before x=375.
- **VIS-RESULT-NO-CLOSE-OVERLAP: PASS.** The regenerated 375px result dialog uses mobile right padding and its title and complete safety description do not intersect the close control.
- **VIS-NO-FALSE-SUCCESS: PASS.** The result is visibly `outcome_unknown` with warning styling and recovery copy. The source maps this state to `status-pending`, and the e2e flow asserts zero success toasts after the publish response.
- **VIS-RESPONSIVE: PASS except blocker above.** The 375/768/1280 main, exact, and outcome layouts otherwise show no clipping, horizontal overflow, or unreachable action.

## Artifact integrity, freshness, and hashes

`gbp-wave3-visual-revise-captures.log` records valid PNG signature `89504e470d0a1a0a` for all 11 files. Independent `identify`, `stat`, and SHA-256 checks matched the receipt exactly. Captures were generated at 22:42:40--22:42:46 BST after the relevant production source (latest 22:33:20) and e2e source (22:41:53).

Dimensions and receipt hashes checked:

- `main-linked`: 375x1400 `036fd1fa…1527`; 768x1400 `b02c37a2…8ae`; 1280x1000 `993a603b…437`.
- `exact-confirmation-375-initial`: 375x812 `755b2ba8…0173`.
- `exact-confirmation-375-scrolled`: 375x812 `b8bd2bd7…7e68`.
- `exact-confirmation`: 375x2600 `e37609a0…caca`; 768x1600 `a13bb6fa…752d`; 1280x1200 `a73f17f8…b63`.
- `outcome-unknown`: 375x900 `2034ae0f…0c5`; 768x900 `1cada58b…7c31`; 1280x940 `3d818893…2fdd`.

## Test and code quality review

The focused Playwright evidence reports 1/1 passing in 13.6 seconds. ESLint and typecheck evidence are green. The e2e assertions exercise observable browser behavior rather than merely testing screenshot existence. The capture loop is modest and the normal-height initial/scrolled pair is necessary evidence, not an excessive duplicate. No deletion-only, tautological, implementation-mirroring, or requested-removal-only test was found. Relevant production code uses typed readonly props and shared Dialog/Alert/Badge/Button/Checkbox primitives; no `any`, suppression, raster substitute, needless parser/normalizer, or speculative abstraction was found. The only blocking issue is the stated rendered collision.

## Checked artifacts

- All 11 PNGs named in `.omo/evidence/gbp-wave3-visual-revise-captures.log`
- `.omo/evidence/gbp-wave3-visual-revise-captures.log`
- `.omo/evidence/gbp-wave3-initial-settled-playwright.log`
- `.omo/evidence/gbp-wave3-initial-settled-eslint.log`
- `.omo/evidence/gbp-wave3-initial-settled-typecheck.log`
- `.omo/evidence/gbp-wave3-initial-settled-format.log`
- `.omo/evidence/gbp-wave3-initial-settled-diff-check.log`
- `DESIGN.md`
- `components/ui/dialog.tsx`
- `src/components/features/restaurant-settings/RestaurantSettingsChromeHeader.tsx`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx`
- `src/components/features/restaurant-settings/google-business-profile/sections/GbpWorkflowFrame.tsx`
- `tests/e2e/ops-gbp-dual-sync.spec.ts`
- `tests/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.test.tsx`
- `tests/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.test.tsx`

## Exact evidence gaps

- No regenerated 375 x 812 exact-confirmation artifact currently demonstrates a collision-free title/close layout.
- The e2e test checks dialog containment and focus but does not compare the close button and title bounding boxes; the existing screenshot supplies affirmative evidence of overlap.

## Re-review condition

Reserve mobile inline-end space in the exact-confirmation header (or otherwise move the close control), add a title-versus-close non-overlap assertion, and regenerate at least the fresh 375 x 812 initial capture plus its hash receipt. Reinspect that artifact before approval.
