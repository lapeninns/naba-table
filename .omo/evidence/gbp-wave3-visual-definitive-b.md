# GBP Wave 3 definitive visual gate B

## Recommendation

**REVISE**

## Original intent

Ship a responsive Google Business Profile operator flow whose linked state, exact-publish confirmation, and truthful `outcome_unknown` result are legible and operable at 375, 768, and 1280 pixels. The 375 x 812 exact dialog must be settled wholly inside the viewport, scroll internally to both acknowledgements and the publish action, preserve keyboard focus containment/restoration, and avoid header, workflow-label, title/close, and result/close collisions.

## Desired outcome

All 11 final PNGs must be fresh, fully settled captures of the current implementation at their declared dimensions. The browser contract must independently prove containment, internal scrolling, exact title/close separation, focus behavior, reachable actions, and absence of false success.

## User outcome review

The exact-dialog header padding repair is successful. In the current `gbp-wave3-exact-confirmation-375-initial.png`, the title wraps to two centered lines and ends well before the 44px close control; the E2E test now also compares their bounding boxes. The linked-state header and `Review changes` workflow control remain separated and in bounds at 375px. The scrolled mobile exact dialog reaches both acknowledgements and both footer actions without escaping its bounded shell. The outcome dialog remains collision-free and truthfully presents `outcome_unknown` as a warning rather than success. All three width families otherwise remain legible and unclipped.

The evidence set is not yet approvable because two of the required final PNGs visibly contain live development-build status overlays: the 375 x 812 initial capture says `Rendering...`, and the 375 x 812 scrolled capture says `Compiling...`. These overlays are not part of the shipped product and affirmatively show that the capture environment was still in flight. The screenshots therefore fail the final settled-capture requirement even though the dialog itself appears geometrically settled.

## Blockers

1. **violatedCriterion: VIS-FINAL-CAPTURES-SETTLED**  
   **Observation:** The required initial mobile exact-dialog PNG contains a visible `Rendering...` development status overlay at the bottom-left, so it is not a clean settled product capture.  
   **evidencePointer:** `.omo/evidence/gbp-wave3-exact-confirmation-375-initial.png` (bottom-left).

2. **violatedCriterion: VIS-FINAL-CAPTURES-SETTLED**  
   **Observation:** The required scrolled mobile exact-dialog PNG contains a visible `Compiling...` development status overlay at the bottom-left, affirmatively indicating capture during build activity.  
   **evidencePointer:** `.omo/evidence/gbp-wave3-exact-confirmation-375-scrolled.png` (bottom-left).

## Prior-blocker recheck

| Check                            | Result     | Evidence                                                                                                                                                                                                |
| -------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile settings-header collision | PASS       | `gbp-wave3-main-linked-375.png`; E2E compares title right edge to status-chip x coordinate.                                                                                                             |
| Workflow clipping                | PASS       | `Review changes` is fully visible in `gbp-wave3-main-linked-375.png`; E2E asserts x >= 0 and right <= 375.                                                                                              |
| Result close overlap             | PASS       | `gbp-wave3-outcome-unknown-375.png`; result header reserves mobile inline-end space via `pr-12 sm:pr-0`.                                                                                                |
| Exact close/title overlap        | PASS       | `gbp-wave3-exact-confirmation-375-initial.png`; exact header now uses `pr-12 sm:pr-0`; E2E asserts title right <= close x.                                                                              |
| In-flight capture                | **REVISE** | Required initial and scrolled 375 x 812 PNGs visibly show `Rendering...` / `Compiling...` overlays.                                                                                                     |
| Internal scroll                  | PASS       | Initial/scrolled pair shows distinct top/bottom states; E2E asserts `scrollHeight > clientHeight`, initial `scrollTop === 0`, scrolls the dialog element, and checks acknowledgement/action visibility. |
| Focus trap/restoration           | PASS       | E2E proves initial title focus, Tab/Shift+Tab containment through Close and acknowledgement, Escape close, trigger restoration, keyboard reopen, and title refocus.                                     |
| False success                    | PASS       | Outcome PNGs show warning styling and recovery copy; source maps unknown to `status-pending`; E2E asserts no success toast.                                                                             |

## Size and artifact verification

Directly opened and inspected all 11 current PNGs. `file` reports valid non-interlaced RGB PNGs at these exact dimensions:

- Main linked: 375x1400, 768x1400, 1280x1000.
- Exact mobile viewport pair: 375x812 initial, 375x812 scrolled.
- Exact full/tall states: 375x2600, 768x1600, 1280x1200.
- Outcome unknown: 375x900, 768x900, 1280x940.

The PNG signatures and current SHA-256 values match `.omo/evidence/gbp-wave3-visual-revise-captures.log`. Capture mtimes (22:47:10--22:47:16 BST) are newer than the relevant production sources; the E2E source was saved at 22:46:17 and the focused Playwright run subsequently passed 1/1. Freshness alone does not cure the visible in-flight overlays.

## Source, test, and slop review

- `GbpExactPublishDialog.tsx` uses live shared Dialog, Alert, Badge, Button, Checkbox, Label, and Separator primitives; it is not a raster substitute. The header-padding repair is the smallest relevant production change.
- `GbpExactPublishResultDialog.tsx` retains the same responsive close clearance and truthful unknown-outcome mapping.
- `ops-gbp-dual-sync.spec.ts` exercises observable browser geometry and interactions. The title/close assertion is meaningful regression coverage, not a tautology, implementation mirror, deletion-only test, or requested-removal-only test.
- The initial/scrolled capture pair is necessary to prove internal scrolling, not excessive duplication. No new parser, normalizer, speculative abstraction, disabled check, `any`, or suppression was found in the reviewed UI seam.

## Checked artifacts

- All 11 PNGs listed in `.omo/evidence/gbp-wave3-visual-revise-captures.log`
- `.omo/evidence/gbp-wave3-visual-revise-captures.log`
- `.omo/evidence/gbp-wave3-exact-close-playwright.log`
- `tests/e2e/ops-gbp-dual-sync.spec.ts` (shipped-route scenario and bbox/focus/scroll assertions)
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx`
- `src/components/features/restaurant-settings/RestaurantSettingsChromeHeader.tsx`
- `src/components/features/restaurant-settings/google-business-profile/sections/GbpWorkflowFrame.tsx`
- `components/ui/dialog.tsx`

## Exact evidence gaps

- No clean final 375 x 812 initial exact-dialog capture exists without a development rendering/compilation overlay.
- No clean final 375 x 812 scrolled exact-dialog capture exists without a development rendering/compilation overlay.

## Re-review condition

Wait for the application and development indicator to become idle, regenerate the two 375 x 812 initial/scrolled exact-dialog PNGs (and receipt hashes), and directly confirm both frames are clean. No additional product-code repair is indicated by this review.
