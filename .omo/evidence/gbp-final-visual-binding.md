# GBP final visual-evidence binding audit — PASS

## Decision

**PASS.** The current 11-frame GBP visual matrix is bound to the current product
render path represented by final worktree fingerprint
`7fa1ff4b71354b28d669efdcc87a5c663e9663ec2bf29c7649858b078041fdd2`.

This is a read-only evidence-binding review. I directly opened every current PNG
at original detail, recomputed every SHA-256 digest, inspected the corrected
receipt and Playwright transcript, and traced the current DOM render path. I did
not re-run the browser or alter product source.

## Evidence inspected

- All 11 current PNGs:
  - `gbp-wave3-main-linked-{375,768,1280}.png`
  - `gbp-wave3-exact-confirmation-{375-initial,375-scrolled,375,768,1280}.png`
  - `gbp-wave3-outcome-unknown-{375,768,1280}.png`
- `.omo/evidence/gbp-wave3-visual-revise-captures.log`
- `.omo/evidence/gbp-wave3-framework-chrome-free-playwright.log`
- Prior independent visual reports:
  - `.omo/evidence/gbp-wave3-visual-final-clean-a.md`
  - `.omo/evidence/gbp-wave3-visual-final-clean-b.md`
- `.omo/start-work/ledger.jsonl` entries stamped with the supplied worktree
  fingerprint.
- Current product/render source:
  - `src/services/ops/restaurants.ts:1450-1460`
  - `src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx:88-256`
  - `src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx:24-96`
  - `src/components/features/restaurant-settings/dual-sync/DualSyncShellDialogs.tsx`
  - `src/components/features/restaurant-settings/google-business-profile/sections/GbpWorkflowFrame.tsx`
  - `components/ui/dialog.tsx`
  - `tests/e2e/ops-gbp-dual-sync.spec.ts:344-390`

## Exact capture binding

The corrected receipt records all captures at
`2026-08-10T01:18:03–01:18:10+0100`. Every current image is a non-empty RGB PNG
with the recorded dimensions, magic bytes `89504e470d0a1a0a`, byte length, and
SHA-256. Direct recomputation matched **11/11** receipt digests:

| State           |  Viewport | SHA-256                                                            |
| --------------- | --------: | ------------------------------------------------------------------ |
| main linked     |  375×1400 | `39c9e41550cc3acbcc1692d347fdd67776677a55362963ff7be8335ac3a62207` |
| main linked     |  768×1400 | `69cf8f8ebb904b4b3d784ce59880b089288fdfdb10805b6cdf5f61406998e434` |
| main linked     | 1280×1000 | `332667b807e039b012b2b7ac444c364f427d7f9e6a6d5da0b71dabed0a0b1349` |
| exact, initial  |   375×812 | `7b8f49ee87c8f2bfff21f6bd3446e7e4c80e28f663f70196f82f47540996346b` |
| exact, scrolled |   375×812 | `34943706c32108902b44292862a1be5d49fa438041fac2d903577d40749f0efa` |
| exact           |  375×2600 | `dcc56f52ca59cb7fdb930dbb4ab2df536a63215bc7351195764b164b9f4b7445` |
| exact           |  768×1600 | `db73f153cc08c4a4c9fe7e372ecb2613b71ad3fa3607247ca2ba5fafcdb3273b` |
| exact           | 1280×1200 | `92fcf77dc6e40b8528c32bd9509d968467da863deea0c8f6c68279e99ad4ec04` |
| outcome unknown |   375×900 | `fdf4abae56043ebb0f039fcd09eb2bc5b37818aa1086bbf9206792b5b1105b4d` |
| outcome unknown |   768×900 | `1aeb1d8750b1634aa6eab5e32f6c9233e78fafd2e1df505bf3bf73b7ca16f109` |
| outcome unknown |  1280×940 | `299cb2839496bd5b251c29f2938c2f2b2f706614f1ad8f873895549d03981849` |

The authenticated current-source Playwright transcript reports all five GBP
scenarios passing in 17.3 seconds. It includes the evidence scenario that
produces the responsive linked, exact-confirmation, and unknown-outcome states.

## Source chronology

1. `src/services/ops/restaurants.ts` changed at `00:35:01+0100`, updating the
   data endpoints that supply the GBP screen.
2. The entire capture set was regenerated after that product change at
   `01:18:03–01:18:10+0100`.
3. The only later relevant modification is `tests/e2e/ops-gbp-dual-sync.spec.ts`
   at `01:21:41+0100`. Inspection confirms this is screenshot-gating/test
   harness source, not a shipped product component, CSS, shared primitive, or
   browser service. It does not invalidate the current captures.

No later product/render-affecting file was identified in the inspected GBP
render path. The capture image contents, dimensions, and all states are coherent
with the current source: the mobile initial/scrolled pair shows bounded dialog
and bottom acknowledgement/action reachability; the tablet/desktop screens keep
the intended two-column exact-plan hierarchy; the three result screens use a
warning treatment and do not present `outcome_unknown` as success.

## Design-system integrity

The reviewed product remains live DOM/UI code, not a raster substitute.
`GbpExactPublishDialog` maps preview groups into semantic sections using shared
`Dialog`, `Alert`, `Badge`, `Button`, `Checkbox`, `Label`, and `Separator`
primitives. No inspected GBP render file references an image, data URI, canvas,
or CSS `background-image`/`url()` substitute. Styling uses shared semantic
utilities and primitives; the `max-h-[88vh]` dialog constraint is responsive
containment rather than an image or pixel-position fake.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

None.

## Binding conclusion

The earlier mismatch was a stale receipt, not a stale capture set. The corrected
receipt now authenticates the current images; the captures post-date the only
post-review product render-path change; and the subsequent E2E edit is test-only.
The final fingerprint re-stamp differs only through generated `next-env.d.ts`
normalization to its committed production import, with no shipped UI or test
delta. Together with direct 11-image inspection and the prior independent clean
visual reviews, the visual evidence remains valid for final fingerprint
`7fa1ff4b71354b28d669efdcc87a5c663e9663ec2bf29c7649858b078041fdd2`.
