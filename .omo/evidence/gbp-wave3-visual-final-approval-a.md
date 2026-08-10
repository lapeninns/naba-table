# GBP Wave 3 visual final approval A

## Recommendation

**PASS** — the reviewed GBP operator surface satisfies the final visual gate on the current evidence set.

## Scope and artifact integrity

I directly opened every one of the 11 current PNG captures:

1. `gbp-wave3-main-linked-{375,768,1280}.png`
2. `gbp-wave3-exact-confirmation-375-initial.png`
3. `gbp-wave3-exact-confirmation-375-scrolled.png`
4. `gbp-wave3-exact-confirmation-{375,768,1280}.png`
5. `gbp-wave3-outcome-unknown-{375,768,1280}.png`

`.omo/evidence/gbp-wave3-visual-revise-captures.log` records a valid PNG signature, expected dimensions, non-zero byte size, and SHA-256 for each. The captures were recorded at 2026-08-09 22:42:40–22:42:46 BST, after the last reviewed rendered-source edit (`GbpExactPublishDialog.tsx`, 22:33:20) and current E2E edit (22:41:53).

## Findings

### CRITICAL

None. The GBP UI is a live React/Radix/shadcn component tree, not a raster substitute. `GbpExactPublishDialog.tsx` composes shared `Dialog`, `Alert`, `Badge`, `Button`, `Checkbox`, `Label`, and `Separator` primitives and maps live preview groups into DOM sections ([GbpExactPublishDialog.tsx:89](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx:89), [GbpExactPublishDialog.tsx:172](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx:172)). No inspected GBP component contains an image, canvas, data URI, or background-image render substitute.

### HIGH

None. The earlier 375×812 in-flight capture is no longer present: the current initial frame shows the dialog fully inside the viewport, with visible title, close control, content, and lower edge. It is vertically bounded and uses internal scroll for additional content.

### MEDIUM

None.

### LOW

None.

## Verified criteria

| Criterion                                             | Result | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 375×812 initial exact dialog is settled and in bounds | PASS   | The initial capture is centered within the 16px side margins and has no clipped dialog/title/close control. The test waits for every subtree animation to finish, then asserts `x >= 0`, `right <= 375`, `y >= 0`, and `bottom <= 812` before capturing ([ops-gbp-dual-sync.spec.ts:621](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/tests/e2e/ops-gbp-dual-sync.spec.ts:621), [ops-gbp-dual-sync.spec.ts:635](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/tests/e2e/ops-gbp-dual-sync.spec.ts:635)).                                                                                                                                                                                                                                                               |
| 375×812 scroll workflow and close repair              | PASS   | The scrolled frame reaches the FoodMenus replacement warning, both acknowledgements, disabled publish action, and Cancel without escaping the bounded modal. E2E verifies title focus, Tab/Shift+Tab traversal, scroll reachability, Escape close, and trigger focus restoration ([ops-gbp-dual-sync.spec.ts:644](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/tests/e2e/ops-gbp-dual-sync.spec.ts:644)).                                                                                                                                                                                                                                                                                                                                                                         |
| 375 / 768 / 1280 layout                               | PASS   | Main linked/operator, tall exact-confirmation, and outcome-unknown captures are legible at all three widths. At 375 the workflow row stays within bounds; at 768/1280 the controls and comparison data use the intended multi-column layout without collision.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Exact consent and FoodMenus truth                     | PASS   | The dialog renders listing/account identity, generation/epoch, version triplet, fingerprint, issue/expiry, PATCH/masks/resources, before/after values, warnings, and the separate destructive FoodMenus acknowledgement from the preview model ([GbpExactPublishDialog.tsx:130](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx:130), [GbpExactPublishDialog.tsx:172](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx:172), [GbpExactPublishDialog.tsx:227](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx:227)). |
| Unknown outcome is truthful                           | PASS   | All outcome captures keep `outcome_unknown` as a warning/pending condition, instruct refresh/listing verification/new preview and operational-channel verification, and contain no success treatment. The browser test asserts no Sonner success toast ([GbpExactPublishResultDialog.tsx:24](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx:24), [ops-gbp-dual-sync.spec.ts:690](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/tests/e2e/ops-gbp-dual-sync.spec.ts:690)).                                                                                                                                                                                                          |
| Shared, token-driven implementation                   | PASS   | Layout, spacing, color, typography, radius and shadow come from shared shadcn/Tailwind semantic utilities and UI primitives; e.g. the shared dialog uses `bg-background`, `ring-border`, `ring-ring`, and responsive primitives rather than component-local colors ([dialog.tsx:42](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/components/ui/dialog.tsx:42)). The sole arbitrary viewport cap in scope (`max-h-[88vh]`) is a responsive containment rule, not a one-off visual token ([GbpExactPublishDialog.tsx:90](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx:90)).                                                                                                             |

## Good qualities to retain

- The initial 375×812 capture now distinguishes a bounded, scrollable dialog from a clipped or in-flight one.
- Exact confirmation uses a hierarchy appropriate to irreversible external writes: metadata, discrete change cards, warnings, then two independent acknowledgements.
- The outcome dialog stays compact at 375px while preserving clear close-button clearance and recovery instructions.
- The responsive structure is live and extensible: a shared dialog primitive plus reused semantic components, not a screenshot-matched one-off.

## Blockers

None.

## Evidence inspected

- All 11 PNG files named above.
- `.omo/evidence/gbp-wave3-visual-revise-captures.log`
- `.omo/evidence/gbp-wave3-initial-settled-playwright.log` (one shipped-route browser scenario passed)
- `tests/e2e/ops-gbp-dual-sync.spec.ts:509-719`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx`
- `components/ui/dialog.tsx`
- `DESIGN.md`
