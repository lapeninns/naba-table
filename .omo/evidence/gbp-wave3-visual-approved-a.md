# GBP Wave 3 visual approval A — dev-overlay-free recapture

## Verdict

**PASS** — the complete current capture set passes the visual approval gate. No `Rendering`, `Compiling`, or other development overlay is visible, and the prior layout, content, focus, scroll, truthfulness, and responsive checks remain satisfied.

## Capture set and freshness

All 11 current PNGs were directly inspected:

1. `gbp-wave3-main-linked-375.png` (375×1400)
2. `gbp-wave3-main-linked-768.png` (768×1400)
3. `gbp-wave3-main-linked-1280.png` (1280×1000)
4. `gbp-wave3-exact-confirmation-375-initial.png` (375×812)
5. `gbp-wave3-exact-confirmation-375-scrolled.png` (375×812)
6. `gbp-wave3-exact-confirmation-375.png` (375×2600)
7. `gbp-wave3-exact-confirmation-768.png` (768×1600)
8. `gbp-wave3-exact-confirmation-1280.png` (1280×1200)
9. `gbp-wave3-outcome-unknown-375.png` (375×900)
10. `gbp-wave3-outcome-unknown-768.png` (768×900)
11. `gbp-wave3-outcome-unknown-1280.png` (1280×940)

`.omo/evidence/gbp-wave3-visual-revise-captures.log` records a valid PNG signature, non-zero bytes, dimensions, mtime, and SHA-256 for each. Their 22:52:45–22:52:52 BST timestamps are after the last rendered-source or E2E edit; no file under `src/components`, `components/ui`, `tests/e2e`, or `DESIGN.md` is newer than the latest capture.

The fresh browser receipt, `.omo/evidence/gbp-wave3-dev-indicator-free-playwright.log`, reports the shipped-route scenario passed (1/1) after the recapture. The scenario explicitly polls all light-DOM and shadow-DOM descendants until no exact `Rendering`, `Rendering...`, `Rendering…`, `Compiling`, `Compiling...`, or `Compiling…` text remains before the state captures ([ops-gbp-dual-sync.spec.ts:347](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/tests/e2e/ops-gbp-dual-sync.spec.ts:347), [ops-gbp-dual-sync.spec.ts:669](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/tests/e2e/ops-gbp-dual-sync.spec.ts:669), [ops-gbp-dual-sync.spec.ts:689](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/tests/e2e/ops-gbp-dual-sync.spec.ts:689)). Direct image inspection independently confirms that none of the 11 frames contains a development overlay.

## Findings

### CRITICAL

None. The surface is live UI, not a raster substitute: the confirmation uses shared `Dialog`, `Alert`, `Badge`, `Button`, `Checkbox`, `Label`, and `Separator` components and maps preview groups to DOM sections ([GbpExactPublishDialog.tsx:5](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx:5), [GbpExactPublishDialog.tsx:172](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx:172)).

### HIGH

None. No development overlay, clipped dialog frame, missing close action, escaped modal, false-success outcome, or responsive collision was observed.

### MEDIUM

None. The blue rectangles around the dialog title and checkbox controls are intentional, visible keyboard-focus states, corroborated by focus assertions in the E2E flow; they are not development UI or screenshot artefacts ([ops-gbp-dual-sync.spec.ts:648](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/tests/e2e/ops-gbp-dual-sync.spec.ts:648)).

### LOW

None.

## Criteria rechecked

| Criterion                                       | Result | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Development-overlay-free captures               | PASS   | All 11 inspected frames are free of `Rendering`/`Compiling` overlays; DOM + shadow-DOM polling is enforced before the dialog captures.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Main linked/operator layout at 375 / 768 / 1280 | PASS   | All three main captures show intact command-centre hierarchy, bounded controls, legible tags, and no horizontal collision.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Exact confirmation initial state                | PASS   | The 375×812 initial frame shows a fully composed, bounded dialog with title, description, close control, metadata, and internal-scroll continuation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Exact confirmation scroll and focus             | PASS   | The scrolled 375×812 frame reaches both independent acknowledgements, disabled publish action, and Cancel within the modal. The test verifies title focus, Tab/Shift+Tab order, Escape close, and trigger-focus restoration ([ops-gbp-dual-sync.spec.ts:644](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/tests/e2e/ops-gbp-dual-sync.spec.ts:644)).                                                                                                                                                                                                                                                                               |
| Full confirmation content                       | PASS   | Tall 375, 768, and 1280 frames preserve listing identity, versions, fingerprint, issued/expiry values, PATCH/resource/mask cards, before/after values, warning, and separate external-write/FoodMenus acknowledgements.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Responsive dialog composition                   | PASS   | Narrow layout is vertically structured without sideways overflow; 768 and 1280 use a stable two-column metadata and before/after composition. Dialog height is bounded by `max-h-[88vh]` with internal scroll ([GbpExactPublishDialog.tsx:89](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx:89)).                                                                                                                                                                                                                                                   |
| Outcome truthfulness                            | PASS   | All three outcome captures label the state `Provider outcome unknown`, direct refresh/listing/new-preview recovery plus operational-channel verification, and do not render success. The component selects warning/pending treatment for `outcome_unknown` ([GbpExactPublishResultDialog.tsx:21](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx:21), [GbpExactPublishResultDialog.tsx:42](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx:42)). |
| Token/primitives compliance                     | PASS   | The reviewed implementation uses the established semantic shadcn/Tailwind primitives and the documented compact responsive rules, rather than a screenshot or component-local colour system ([DESIGN.md](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/DESIGN.md), [dialog.tsx:42](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/components/ui/dialog.tsx:42)).                                                                                                                                                                                                                                                          |

## Evidence inspected

- The 11 PNG artifacts enumerated above, opened individually.
- `.omo/evidence/gbp-wave3-visual-revise-captures.log`
- `.omo/evidence/gbp-wave3-dev-indicator-free-playwright.log`
- `tests/e2e/ops-gbp-dual-sync.spec.ts:347-357, 531-719`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx`
- `components/ui/dialog.tsx`
- `DESIGN.md`

## Blockers

None.
