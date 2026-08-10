# GBP Wave 3 — final clean visual gate B

## recommendation

**PASS / APPROVE**

## blockers

None.

## originalIntent

Ship the Wave 3 Google Business Profile operator workflow as a real, responsive product UI: linked-state controls, an exact one-shot publish confirmation with complete high-risk and FoodMenus replacement consent, accessible keyboard/focus/scroll behavior, and a truthful non-success recovery state for unknown provider outcomes. Final visual evidence must contain no Next.js development chrome and the evidence harness must not alter or crop product UI.

## desiredOutcome

At 375, 768, and 1280 widths, an operator can read and operate the GBP workflow without overlap or viewport loss; inspect listing/fence/version/fingerprint/expiry/method/resource/mask/before-after details; independently acknowledge public writes and complete FoodMenus replacement; close and reopen by keyboard with correct focus; scroll to all modal actions; and receive warning-styled recovery guidance rather than a false success state. The submitted screenshots must be faithful captures of the product component tree.

## userOutcomeReview

The reviewed artifact satisfies the intended outcome. I opened all eleven PNGs at original detail. The linked-state screens are legible at all three widths; the mobile header and workflow navigation remain bounded; operator controls and unknown-outcome notice are visible. The 375 normal-height confirmation is centered and contained, and its paired scrolled capture reaches both independent acknowledgements and the action footer. The tall 375 and the 768/1280 confirmation captures show the required listing identity, connection and consent fence, three versions, full fingerprint, issued/expiry window, PATCH/resource/update-mask details, before/after values, warnings, and complete FoodMenus replacement consent. The result captures consistently use warning treatment, explicitly state that queued/unknown is not success, and provide refresh, listing verification, new-preview, and operational-channel recovery guidance.

No capture contains the Next launcher, `Rendering`, `Compiling`, error badge, or other framework chrome. Focus rings visible on the dialog title and checkboxes are genuine product keyboard-focus states corroborated by the E2E assertions.

## harnessIntegrity

`tests/e2e/ops-gbp-dual-sync.spec.ts:374-383` queries exactly `nextjs-portal`, removes only those returned nodes, and asserts every removed node's lower-case tag is exactly `nextjs-portal`. It does not query, remove, hide, restyle, resize, clip, crop, or mutate any product element. `assertNextDevToolsAbsent` then recursively checks light and shadow DOM for remaining `nextjs-*` tags, Next dev-tools labels/titles, and exact `Rendering`/`Compiling` indicator text. Screenshots use Playwright's normal screenshot path; the state captures use `fullPage: true`, while the two 375 normal-height dialog frames intentionally capture the viewport to prove initial and scrolled reachability. There is no raster substitution, canvas, injected image, screenshot-as-background, CSS override, or product-DOM cleanup in this path.

The framework-clean diff receipt is empty, supporting that the final portal-removal recapture introduced no production or security source change. The reviewed product components remain real React/shadcn/Radix UI code. Production build evidence separately records a completed optimized Next build including `/app/settings/restaurant/google-business-profile`.

## criterionResults

| Criterion                                   | Result | Evidence                                                                                                                                                                          |
| ------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No framework chrome                         | PASS   | Direct inspection of 11 PNGs; `ops-gbp-dual-sync.spec.ts:344-383`; green 5-scenario Playwright receipt.                                                                           |
| Harness removes only framework portal       | PASS   | Exact `nextjs-portal` selector/removal plus tag assertion; no product selector/CSS/crop mutation.                                                                                 |
| Product/security unchanged by final cleanup | PASS   | `.omo/evidence/gbp-wave3-framework-chrome-free-diff-check.log` is empty; capture-only harness seam inspected.                                                                     |
| Responsive layout                           | PASS   | Linked, confirmation, and result evidence at 375/768/1280; geometry assertions at `:600-639`, `:664-713`, and `:755-771`.                                                         |
| Dialog containment and scrolling            | PASS   | 375 initial/scrolled pair and E2E client/scroll-height, bounding-box, and in-viewport assertions.                                                                                 |
| Focus and escape restoration                | PASS   | Title autofocus, Tab/Shift+Tab traversal, Escape close, trigger restoration, Enter reopen asserted at `:646-720`; source restoration logic at `GbpExactPublishDialog.tsx:90-102`. |
| Exact-plan content                          | PASS   | Direct screenshots plus E2E assertions for listing, expiry, masks, before/after, and FoodMenus at `:646-661`, `:722-737`.                                                         |
| FoodMenus independent consent               | PASS   | Separate destructive acknowledgement in screenshots/source; publish remains disabled until both acknowledgements (`GbpExactPublishDialog.tsx:68-85,216-253`).                     |
| Truthful unknown outcome                    | PASS   | Warning UI and recovery text in all result captures; no Sonner success toast asserted at `:742-753`.                                                                              |
| Production build                            | PASS   | `.omo/evidence/gbp-wave3-production-build.log` completes compilation, type checking, static generation, tracing, and final optimization.                                          |

## directProgrammingAndSlopPass

The E2E assertions cover observable browser behavior and safety outcomes rather than merely proving that requested text or a removed element is absent. The portal helper's exact-tag assertion is a legitimate evidence-integrity guard, not the sole success proof: direct image inspection, recursive post-removal absence checks, responsive geometry, focus traversal, scrolling, request counts, recovery UI, and zero-success-toast behavior independently exercise the user-visible contract. The three responsive widths and paired 375 initial/scrolled views are necessary coverage, not redundant screenshots. I found no deletion-only, tautological, implementation-mirroring, or prose-only test; no unnecessary parser/normalizer/extraction; no raster fake; and no new production abstraction in the final cleanup seam.

The earlier functional gate explicitly records the same `programming` and `remove-ai-slops` perspectives. It notes no criterion-breaking overfit, tautological deletion-only test, raw-provider leakage, untyped production escape hatch, or unnecessary Wave 3 abstraction. No distinct final code-review report with that explicit coverage was supplied; per gate policy, the functional report plus this direct pass supports completion.

## checkedArtifactPaths

- `.omo/evidence/gbp-wave3-main-linked-{375,768,1280}.png`
- `.omo/evidence/gbp-wave3-exact-confirmation-{375-initial,375-scrolled,375,768,1280}.png`
- `.omo/evidence/gbp-wave3-outcome-unknown-{375,768,1280}.png`
- `.omo/evidence/gbp-wave3-visual-revise-captures.log`
- `.omo/evidence/gbp-wave3-framework-chrome-free-playwright.log`
- `.omo/evidence/gbp-wave3-framework-chrome-free-diff-check.log`
- `.omo/evidence/gbp-wave3-production-build.log`
- `.omo/evidence/gbp-wave3-functional-gate.md`
- `.omo/evidence/gbp-wave3-visual-final-clean-a.md`
- `tests/e2e/ops-gbp-dual-sync.spec.ts`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx`
- `src/components/features/restaurant-settings/dual-sync/DualSyncShellDialogs.tsx`
- `src/components/features/restaurant-settings/google-business-profile/components/GbpOperatorControls.tsx`
- `src/components/features/restaurant-settings/google-business-profile/sections/GbpWorkflowFrame.tsx`
- `components/ui/dialog.tsx`
- `DESIGN.md`

## reproducedEvidence

- Independently recomputed SHA-256 for all 11 PNGs: every digest matches `.omo/evidence/gbp-wave3-visual-revise-captures.log`.
- Independently inspected file signatures/dimensions: all 11 are non-empty RGB PNGs with the receipt dimensions.
- Framework-clean Playwright receipt: **5 passed in 17.3s**.
- Production build receipt: completed optimized build and emitted the shipped GBP route.

## exactEvidenceGaps

- No separate final code-review artifact explicitly covering both required skill perspectives was found. This is non-blocking because `.omo/evidence/gbp-wave3-functional-gate.md` records that coverage and this gate independently repeated the pass.
- The final Playwright receipt is an artifact rather than a test rerun by this read-only reviewer. Its assertions, timestamps, image hashes, source path, and production build receipt were independently inspected; no contradictory evidence was found.
- External staging/provider mutation is outside this visual gate and was not required or performed.
