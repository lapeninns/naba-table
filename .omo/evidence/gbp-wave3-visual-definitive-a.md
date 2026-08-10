# GBP Wave 3 definitive visual / clone-fidelity review A

**Verdict:** PASS  
**Recommendation:** APPROVE

## Scope and method

Read-only review after the exact-dialog close-clearance repair. The visual contract is
the existing Nabatable restaurant-settings command-centre and `DESIGN.md`; no external
pixel-reference was supplied. I directly opened every current capture at original
resolution, inspected the live source and shipped-route browser assertions, and did not
treat earlier review conclusions as proof.

## Evidence inspected

All eleven required captures were opened:

1. `.omo/evidence/gbp-wave3-main-linked-375.png` — 375 x 1400
2. `.omo/evidence/gbp-wave3-main-linked-768.png` — 768 x 1400
3. `.omo/evidence/gbp-wave3-main-linked-1280.png` — 1280 x 1000
4. `.omo/evidence/gbp-wave3-exact-confirmation-375.png` — 375 x 2600
5. `.omo/evidence/gbp-wave3-exact-confirmation-375-initial.png` — 375 x 812
6. `.omo/evidence/gbp-wave3-exact-confirmation-375-scrolled.png` — 375 x 812
7. `.omo/evidence/gbp-wave3-exact-confirmation-768.png` — 768 x 1600
8. `.omo/evidence/gbp-wave3-exact-confirmation-1280.png` — 1280 x 1200
9. `.omo/evidence/gbp-wave3-outcome-unknown-375.png` — 375 x 900
10. `.omo/evidence/gbp-wave3-outcome-unknown-768.png` — 768 x 900
11. `.omo/evidence/gbp-wave3-outcome-unknown-1280.png` — 1280 x 940

Also inspected:

- `.omo/evidence/gbp-wave3-visual-revise-captures.log` (PNG signature, dimensions,
  SHA-256 and capture receipt)
- `.omo/evidence/gbp-wave3-exact-close-playwright.log` (one shipped-route browser
  scenario passed)
- `.omo/evidence/gbp-wave3-exact-close-green.log` and prior red receipt
- `DESIGN.md`
- `components/ui/dialog.tsx:17-100`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx:47-258`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx:15-99`
- `tests/e2e/ops-gbp-dual-sync.spec.ts:570-726`
- `tests/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.test.tsx:65-140`
- `tests/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.test.tsx:6-34`

## Freshness and authenticity

The eleven files are valid RGB PNGs with the named dimensions and the expected PNG
signature. The repaired exact dialog and its browser test were modified at
22:46:16–22:46:17; all captures were produced at 22:47:10–22:47:16 and the signed
capture receipt at 22:47:39. The browser receipt reports the exact shipped-route test
passing at 22:47:16. This is fresh evidence for the current repair.

The rendered UI is a live React/Radix/shadcn tree: `Dialog`, `DialogContent`,
`DialogHeader`, `DialogTitle`, `DialogFooter`, `Alert`, `Badge`, `Button`, `Checkbox`,
`Label`, and `Separator` compose the dialogs. No raster `<img>`, canvas, data URI, or
`background-image` substitute occurs in the reviewed GBP-dialog implementation.
Semantic utility tokens and shared component variants supply colour, spacing, type,
radius, and elevation; the scoped code contains no raw colour override or one-off
visual system.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

None.

## Verified requirements

| Requirement                               | Result | Evidence                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact-dialog 375 title / close clearance  | Pass   | The settled initial frame shows the title fully visible left of the 44px close target. The header reserves `pr-12 sm:pr-0` at `GbpExactPublishDialog.tsx:104-112`; browser assertions require title-right <= close-left at `ops-gbp-dual-sync.spec.ts:640-649`.                                                                                                              |
| Result-dialog 375 title / close clearance | Pass   | The 375 outcome frame has clear title and descriptive copy with no close-target collision. Equivalent header reserve is at `GbpExactPublishResultDialog.tsx:30-38`, with DOM-rectangle verification at `ops-gbp-dual-sync.spec.ts:710-720`.                                                                                                                                  |
| Workflow legibility                       | Pass   | The 375 main capture keeps `Review changes` entirely in viewport; 768 and 1280 retain the expanded command-centre hierarchy. Bounds are asserted at `ops-gbp-dual-sync.spec.ts:570-582`.                                                                                                                                                                                     |
| Bounded scroll and keyboard focus         | Pass   | The normal-height initial and scrolled 375 frames prove distinct dialog scroll positions. Source applies bounded internal scrolling at `GbpExactPublishDialog.tsx:89-103`; the browser test proves overflow, initial top, end reachability, Tab/Shift+Tab containment, Escape close, trigger focus restore, and reopened-title focus at `ops-gbp-dual-sync.spec.ts:621-675`. |
| Full exact / FoodMenus content            | Pass   | Tall 375, 768, and 1280 frames show identity, versions, fingerprint, expiry, PATCH resource/masks, before/after values, warnings, both acknowledgements and disabled publish. The scrolled phone frame directly shows the complete FoodMenus warning, replacement acknowledgement, publish and cancel controls. Live mapping is at `GbpExactPublishDialog.tsx:130-255`.      |
| Unknown outcome safety                    | Pass   | All three outcome frames label the result as unknown and direct refresh, listing verification, a new preview, and operational-channel verification. No green success toast is present; the browser test asserts zero toasts at `ops-gbp-dual-sync.spec.ts:697-708`.                                                                                                          |
| 768 / 1280 responsive layout              | Pass   | Main, exact-confirmation, and outcome captures are clean at both widths: no clipping, title/close collision, or unreadable overflow. Exact values use two columns from `sm` while retaining one-column mobile fallback (`GbpExactPublishDialog.tsx:130-168,192-205`).                                                                                                        |
| Real shared design system                 | Pass   | Shared primitives implement layers and interaction semantics (`components/ui/dialog.tsx:17-100`); `DESIGN.md` defines the semantic token / compact-shadcn contract used by the GBP components.                                                                                                                                                                               |

## Good, preserve

- The exact dialog presents high-risk provider facts in a readable layer order:
  identity and expiry, per-resource mutation facts, warnings, then explicit
  acknowledgements and actions.
- The 375px dialog is now a real narrow-screen modal, not a desktop dialog squeezed
  into the viewport. Its close target, focus treatment, and long content remain
  usable.
- Unknown-provider outcome remains a fail-stop warning in both source and captures;
  it is not visually or textually treated as a successful publish.

## Blockers

None.

## Completion gate

Satisfied for the reviewed Wave 3 visual surface: all eleven current captures were
opened, the repair is represented by fresh executable/browser evidence, and no
critical, high, medium, or low fidelity issue remains in the scoped dialogs and
responsive states.
