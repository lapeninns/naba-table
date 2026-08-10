# GBP Wave 3 visual gate B

## Verdict

**REVISE** — the final artifacts are fresh, valid, and broadly complete, but the 375px shipped route has two visible responsive collisions. The outcome dialog's close control obscures the required status description, and the workflow strip truncates its rightmost step at the viewport edge.

## Scope and intent

Fresh independent visual review of the shipped Google Business Profile route at 375, 768, and 1280 pixels across:

- linked main/operator state;
- exact publish confirmation;
- immediate `outcome_unknown` result.

The expected outcome from `DESIGN.md` is a compact, evidence-led operator surface in which controls remain reachable on narrow screens, dialogs scroll internally, exact consent exposes all identity and risk facts, and an unknown provider outcome is never represented as success.

## Artifact integrity and freshness

All nine requested captures were opened directly at original resolution.

| Capture                                 | Dimensions | PNG           | Freshness                             | Visual result |
| --------------------------------------- | ---------: | ------------- | ------------------------------------- | ------------- |
| `gbp-wave3-main-linked-375.png`         |   375x1400 | valid RGB PNG | 22:18:04, after relevant source edits | revise        |
| `gbp-wave3-main-linked-768.png`         |   768x1400 | valid RGB PNG | 22:18:04, after relevant source edits | pass          |
| `gbp-wave3-main-linked-1280.png`        |  1280x1000 | valid RGB PNG | 22:18:04, after relevant source edits | pass          |
| `gbp-wave3-exact-confirmation-375.png`  |   375x2600 | valid RGB PNG | 22:18:04, after relevant source edits | pass          |
| `gbp-wave3-exact-confirmation-768.png`  |   768x1600 | valid RGB PNG | 22:18:04, after relevant source edits | pass          |
| `gbp-wave3-exact-confirmation-1280.png` |  1280x1200 | valid RGB PNG | 22:18:05, after relevant source edits | pass          |
| `gbp-wave3-outcome-unknown-375.png`     |    375x900 | valid RGB PNG | 22:18:10, after relevant source edits | revise        |
| `gbp-wave3-outcome-unknown-768.png`     |    768x900 | valid RGB PNG | 22:18:10, after relevant source edits | pass          |
| `gbp-wave3-outcome-unknown-1280.png`    |   1280x940 | valid RGB PNG | 22:18:10, after relevant source edits | pass          |

The latest directly relevant source timestamp was `GbpExactPublishResultDialog.tsx` at 22:01:09. Other reviewed sources were earlier: `GbpOperatorControls.tsx` at 20:30:29, `GbpExactPublishDialog.tsx` at 20:20:00, and `DESIGN.md` at 20:12:53. Capture hashes, signatures, dimensions, and timestamps are independently listed in `.omo/evidence/gbp-wave3-visual-revise-captures.log`. No black frames, missing compositor regions, invalid signatures, or mismatched widths were found.

## Findings

### Blocking

1. **[product] [responsive collision] [high]** At 375px, the circular close button overlays the second line of the result-dialog description. In `gbp-wave3-outcome-unknown-375.png`, the required phrase ends visually as `an unknow…` beneath the close control. The description is part of the safety contract: queued is not complete and unknown is not success. The shared close button is absolutely positioned at `right-4 top-4` with a 44px footprint (`components/ui/dialog.tsx:51-59`), while `GbpExactPublishResultDialog.tsx:30-38` gives the header no mobile-right clearance. Add reserved inline space for the close control or change the mobile header layout so no title/description glyph can sit underneath it.

2. **[product] [responsive collision] [medium]** At 375px, the horizontal workflow strip clips the rightmost `Review changes` step at the right edge in all three mobile-state captures; the screenshot shows only `Revie…`. The route remains operable through controls below, but this violates the narrow-screen legibility requirement in `DESIGN.md:14-18`. Make the strip intentionally horizontally scrollable with a visible affordance, wrap/condense the steps, or provide a mobile step representation that keeps the current/next step readable.

### Evidence gap (non-product)

3. **[evidence] [keyboard focus] [medium]** The shared dialog is Radix-based and therefore has an appropriate focus-management implementation path, but the supplied final browser run does not assert initial focus, Tab containment, Escape close, or focus restoration. The E2E assertions cover visibility, scroll reachability, acknowledgements, publish, recovery copy, and absence of a success toast (`tests/e2e/ops-gbp-dual-sync.spec.ts:577-646`). Static captures cannot prove keyboard focus. Add a shipped-route keyboard sequence with `toBeFocused()` assertions if keyboard completion evidence is required for final approval.

## Requirement checks

### Main operator controls

- Pass at all widths for the requested operator card itself: linked/eligible state, generation and consent epoch, reason, rollout, refresh status/error, pending location masks, pending attribute paths, password field, write/notification actions, notification participation, and terminal outcome notice are visible.
- The 375px layout stacks fields and buttons without card-content overlap. The 768 and 1280 layouts use space efficiently and remain legible.
- The disabled actions correctly remain readable before password entry.

### Exact consent modal

- Pass at all widths for listing identity, account/profile, connection generation and consent epoch, confirmation/policy/renderer versions, full fingerprint, issued time, explicit <=15-minute expiry, method, resource, update masks, before/after values, warnings, and critical risk.
- The `foodMenus` resource and `menus` mask are present. The full-replacement warning is explicit.
- The separate destructive FoodMenus acknowledgement and the general external-write acknowledgement are both visible; `Publish exact plan` remains disabled in the capture.
- Footer actions are reachable. At 375px they stack cleanly; at 768/1280 they align without collisions.
- The production component uses `max-h-[88vh]` plus `overflow-y-auto` (`GbpExactPublishDialog.tsx:88`), satisfying bounded internal scrolling. The browser test also puts expiry, destructive acknowledgement, and publish control in the viewport at 375px before capture.

### `outcome_unknown`

- Pass for truthfulness: no success toast is present, the state badge is `outcome_unknown`, and the reason is `provider_outcome_unknown`.
- Recovery instructions correctly require refreshing Google state, verifying the listing, creating a new preview before retry, and checking the operational notification channel.
- The source uses warning/pending semantics, not success semantics (`GbpExactPublishResultDialog.tsx:54-83`).
- Revise only for the mobile header collision described above.

### Scroll, focus, and general responsiveness

- No modal or card is clipped vertically in the final captures; exact consent content is fully represented in the tall 375/768 captures.
- No destructive acknowledgement, footer action, field value, or warning collides at 375/768/1280.
- No horizontal overflow was observed in fingerprints, resources, or before/after value blocks; long strings wrap or use their local scroll region.
- Keyboard focus behavior is plausible from the Radix primitive but not reproduced by the supplied test evidence; see evidence gap 3.

## Design/programming review notes

- The surface is a real component tree built from shared Card, Alert, Badge, Button, Dialog, Input, Label, Checkbox, and Separator primitives; it is not a screenshot or raster substitute.
- Styling uses semantic theme variants and responsive utility classes, consistent with `DESIGN.md`; no one-off image fake or raw-color reconstruction was found in the reviewed components.
- The reviewed TypeScript components use readonly props and narrow domain unions. No `any`, `@ts-ignore`, or fake passing behavior was found in the relevant UI files.
- The browser test validates meaningful behavior rather than screenshot existence alone: route state, operator visibility, required exact-plan details, dual acknowledgements, a real publish request, recovery copy, and zero success toasts. The capture helper itself is straightforward and not an implementation-mirroring unit test.

## Checked paths

- `DESIGN.md`
- `components/ui/dialog.tsx`
- `src/components/features/restaurant-settings/RestaurantSettingsChromeHeader.tsx`
- `src/components/features/restaurant-settings/google-business-profile/GoogleBusinessProfileSection.tsx`
- `src/components/features/restaurant-settings/google-business-profile/components/GbpOperatorControls.tsx`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx`
- `tests/e2e/ops-gbp-dual-sync.spec.ts`
- `tests/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.test.tsx`
- `tests/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.test.tsx`
- `.omo/evidence/gbp-wave3-visual-revise-playwright.log`
- `.omo/evidence/gbp-wave3-visual-revise-captures.log`
- `.omo/evidence/gbp-wave3-visual-revise-focused.log`
- `.omo/evidence/gbp-wave3-outcome-toast-green.log`
- all nine PNG paths listed above

## Re-review condition

Regenerate all three `outcome-unknown` captures after reserving mobile header space and all three `main-linked` captures after correcting the workflow strip. Re-run a keyboard-focused shipped-route assertion if focus proof is part of the final acceptance criteria. A new approving pass must inspect the complete fresh nine-capture set.
