# GBP Wave 3 final visual gate B

## recommendation

REJECT

## visualVerdict

REVISE

## originalIntent

Ship a clean, responsive Google Business Profile operator workflow at 375, 768, and 1280 pixels. The final evidence must show the linked workflow, an exact-publish confirmation with visibly distinct close control, bounded mobile scrolling and focus behavior, a dedicated destructive FoodMenus acknowledgement, and a truthful unknown-provider outcome without any development-only overlays.

## desiredOutcome

Eleven fresh shipped-route captures should present only the user-facing product. The 375 x 812 exact confirmation must remain wholly in bounds, scroll internally from its initial state to both acknowledgements and actions, preserve keyboard focus containment/restoration, and clearly separate its title/result content from the close control. Tablet and desktop states must remain legible and unclipped.

## userOutcomeReview

The product UI itself satisfies the reviewed interaction and responsive requirements. Across all three widths, the workflow is legible; the exact confirmation title and the outcome description are separated from the close control; the mobile dialog is bounded and its initial/scrolled pair reaches the destructive FoodMenus acknowledgement and footer; the result consistently presents `outcome_unknown` as warning/recovery rather than success. The 768 and 1280 layouts are coherent and unclipped.

The evidence set is nevertheless not approvable. Direct inspection of all eleven PNGs shows the black circular Next.js development-tools `N` control at the bottom-left of every frame. This is a development-only overlay, not shipped product UI. The capture receipt calls the run “dev-indicator-free,” but it records only signatures, dimensions, hashes, and timestamps; it does not prove visual absence. The E2E helper likewise only searches shadow-DOM text for exact `Rendering` or `Compiling` strings. It does not detect the persistent `N` launcher, so the passing test creates false confidence for the explicit no-dev-overlay criterion.

## blockers

1. **violatedCriterion: VIS-NO-DEV-OVERLAYS**
   - **observation:** All 11 required final captures visibly contain the black circular Next.js development-tools `N` launcher at bottom-left, so none is a clean shipped-product capture.
   - **evidencePointer:** `.omo/evidence/gbp-wave3-main-linked-375.png` (bottom-left), representative; the same control is visible in every PNG enumerated by `.omo/evidence/gbp-wave3-visual-revise-captures.log`.

2. **violatedCriterion: VIS-NO-DEV-OVERLAYS**
   - **observation:** The claimed dev-indicator-free browser guard only rejects exact `Rendering`/`Compiling` text and cannot detect the persistent Next.js `N` launcher seen in the screenshots.
   - **evidencePointer:** `tests/e2e/ops-gbp-dual-sync.spec.ts:343-363`; `.omo/evidence/gbp-wave3-dev-indicator-free-playwright.log`.

## requirementRecheck

| Requirement                                      | Result                                 | Evidence                                                                                                                                                   |
| ------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No development overlays                          | **REVISE**                             | Black Next.js `N` launcher appears at bottom-left in all 11 PNGs.                                                                                          |
| Exact/result close separation                    | PASS                                   | `gbp-wave3-exact-confirmation-375-initial.png`, all exact wide captures, and all outcome captures; bounding-box assertions in `ops-gbp-dual-sync.spec.ts`. |
| Workflow legibility                              | PASS                                   | `gbp-wave3-main-linked-{375,768,1280}.png`; mobile workflow bounds assertion.                                                                              |
| Mobile modal in bounds and internally scrollable | PASS                                   | `gbp-wave3-exact-confirmation-375-{initial,scrolled}.png`; containment, overflow, scroll, and in-viewport assertions.                                      |
| Focus containment/restoration                    | PASS                                   | E2E asserts initial title focus, Tab/Shift+Tab containment, Escape close, trigger restoration, keyboard reopen, and title refocus.                         |
| FoodMenus acknowledgement                        | PASS                                   | Scrolled and tall exact captures show the dedicated full-replacement warning and acknowledgement; source conditionally requires it before publish.         |
| Outcome truthfulness                             | PASS                                   | All outcome captures use warning treatment and recovery guidance; E2E asserts no success toast.                                                            |
| 768/1280 responsiveness                          | PASS                                   | Main, exact, and outcome families are legible and unclipped at both widths.                                                                                |
| Capture freshness/authenticity                   | PASS with visual-quality failure above | PNG mtimes 22:52:45–22:52:52 follow relevant production source and E2E edits; signatures, dimensions, and hashes match the 22:53:15 receipt.               |

## directSlopAndProgrammingPass

The reviewed production components use strict TypeScript and shared Dialog, Alert, Badge, Button, Checkbox, Label, and Separator primitives; no raster substitute, `any`, suppression, speculative parser/normalizer, or unnecessary production extraction was found in this seam. The geometry, scroll, focus, FoodMenus, and outcome tests assert observable behavior rather than implementation details or requested removal alone.

One evidence-test defect is criterion-breaking: `waitForNextDevIndicatorToClear` is too narrowly keyed to transient text and therefore passes while a visible development launcher remains. This is false-confidence coverage under the remove-ai-slops/programming criteria because its name and doneclaim imply a broader visual guarantee than it tests. The prior functional gate explicitly records its own programming/slop pass, but that report does not supersede this direct finding.

## checkedArtifactPaths

- All 11 PNGs enumerated by `.omo/evidence/gbp-wave3-visual-revise-captures.log`
- `.omo/evidence/gbp-wave3-visual-revise-captures.log`
- `.omo/evidence/gbp-wave3-dev-indicator-free-playwright.log`
- `.omo/evidence/gbp-wave3-ui-doneclaim.json`
- `.omo/evidence/gbp-wave3-functional-gate.md`
- `.omo/evidence/gbp-wave3-visual-definitive-a.md`
- `.omo/evidence/gbp-wave3-visual-definitive-b.md`
- `tests/e2e/ops-gbp-dual-sync.spec.ts`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx`
- `src/components/features/restaurant-settings/RestaurantSettingsChromeHeader.tsx`
- `src/components/features/restaurant-settings/google-business-profile/sections/GbpWorkflowFrame.tsx`

## exactEvidenceGaps

- No required final PNG is free of the visible Next.js development-tools launcher.
- No browser assertion or capture-environment receipt proves the entire Next.js development overlay host/launcher is absent; the current assertion covers only two transient text labels.
- A clean production-mode or fully hidden-development-overlay recapture of all 11 required states, with refreshed hashes and direct visual inspection, is still required.

## reReviewCondition

Capture all eleven states from a production build/server, or otherwise disable the complete Next.js development indicator before capture. Refresh the receipt and directly verify that no `N` launcher, rendering/compiling label, error badge, or other development UI appears in any frame.
