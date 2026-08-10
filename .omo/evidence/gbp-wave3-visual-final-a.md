# GBP Wave 3 final visual / clone-fidelity review A

**Verdict: REVISE**  
**Recommendation: REQUEST_CHANGES**

## Scope and freshness

Reviewed the final shipped Google Business Profile UI against `DESIGN.md` and the
Nabatable restaurant-settings visual language. There is no separate pixel-perfect
external reference; the design contract is the reference.

The nine supplied captures are valid RGB PNGs with the requested widths and valid
PNG signatures. They were created at 2026-08-09 22:18:04--22:18:10 BST. No reviewed
file under `src/components/features/restaurant-settings/{google-business-profile,dual-sync}`
or `DESIGN.md` is newer than those captures.

## Evidence inspected directly

- `DESIGN.md`
- `src/components/features/restaurant-settings/google-business-profile/GoogleBusinessProfileSection.tsx:26-114`
- `src/components/features/restaurant-settings/google-business-profile/components/GbpOperatorControls.tsx:17-148`
- `src/components/features/restaurant-settings/google-business-profile/components/GbpOperatorStateDetails.tsx:27-90`
- `src/components/features/restaurant-settings/google-business-profile/components/GbpTerminalNotices.tsx:6-42`
- `src/components/features/restaurant-settings/dual-sync/DualSyncShellDialogs.tsx:17-55`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishDialog.tsx:47-241`
- `src/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog.tsx:15-98`
- `src/components/features/restaurant-settings/dual-sync/hooks/useDualSyncExactPublishActions.ts:39-160`
- `components/ui/{alert,badge,dialog}.tsx`
- `tests/e2e/ops-gbp-dual-sync.spec.ts:509-647`
- `.omo/evidence/gbp-wave3-visual-revise-captures.log`
- `.omo/evidence/gbp-wave3-main-linked-{375,768,1280}.png`
- `.omo/evidence/gbp-wave3-exact-confirmation-{375,768,1280}.png`
- `.omo/evidence/gbp-wave3-outcome-unknown-{375,768,1280}.png`

## Findings

### CRITICAL

None. The implementation is not a screenshot/raster substitution: it is a live
React tree wired to the shared `Card`, `Alert`, `Badge`, `Dialog`, `Button`, `Input`,
`Label`, and `Checkbox` primitives. No image, data URL, canvas, or CSS background
image renders the reviewed surface.

### HIGH

None.

### MEDIUM

1. **[evidence] The supplied 375px exact-confirmation screenshot does not verify
   the required mobile internal-scroll behaviour.** The capture is 375 x 2600,
   and the e2e flow explicitly changes the viewport to that height before asserting
   the FoodMenus acknowledgement and Publish button (`tests/e2e/ops-gbp-dual-sync.spec.ts:608-623`).
   This makes every dialog control visible, but it prevents `max-h-[88vh] overflow-y-auto`
   from being exercised at a normal handset height (`GbpExactPublishDialog.tsx:87-89`).
   It is therefore good content evidence, but insufficient responsive-scroll evidence
   for the stated 375px requirement. Capture a normal-height 375px dialog (for example
   375 x 812) at both its initial and scrolled-to-FoodMenus/acknowledgement position,
   with a browser assertion that the dialog is scrollable and that the bottom controls
   can be reached. This is an **evidence defect**, not a demonstrated product defect.

### LOW

None.

## Verified good

- **Real, reusable design system:** new GBP content composes the shared primitives
  and semantic Tailwind/shadcn tokens. The reviewed Wave 3 code uses `background`,
  `muted`, `border`, `destructive`, `warning`, `success`, and standard spacing/type
  utilities rather than raw hex colours or custom bitmap styling. The alert and
  badge variants resolve through the shared semantic component layer
  (`components/ui/alert.tsx:6-30`, `components/ui/badge.tsx:6-39`).
- **Layer/layout fidelity:** the operator controls sit as compact vertical cards
  after the linked GBP summary (`GoogleBusinessProfileSection.tsx:87-99`), with the
  state detail grid correctly collapsing from two columns at `sm` to one column
  (`GbpOperatorStateDetails.tsx:40-63,74-83`). The 375, 768, and 1280 main captures
  show no horizontal collision or clipped text.
- **Exact confirmation content:** the dialog exposes listing identity, account/profile,
  connection/consent, versions, fingerprint, expiry, method, resource, masks, safe
  before/after values, warnings, and the separate FoodMenus full-replacement
  acknowledgement (`GbpExactPublishDialog.tsx:113-221`). All are visibly present in
  the 768 and 1280 captures, and all content is visible in the tall 375 capture.
- **Outcome uncertainty is truthful:** `outcome_unknown` produces a warning alert,
  warning/pending badge, and specific refresh/listing/new-preview plus operational
  channel recovery instruction (`GbpExactPublishResultDialog.tsx:24-84`). The action
  path emits a warning and reserves success for all-consumed outcomes
  (`useDualSyncExactPublishActions.ts:106-123`). The three outcome screenshots show
  the warning state only; no misleading success toast or success badge is present.
- **Rendered responsive result states:** every supplied outcome modal is fully
  composed and opaque at 375/768/1280, with no overlap from the background and no
  visible clipping. The exact dialogs at 768/1280 and all main linked captures have
  clean hierarchy, readable type, semantic warning/destructive emphasis, and no
  visible collision.

## Blockers before approval

1. Produce fresh normal-height narrow-screen scroll evidence for the exact
   confirmation dialog as described in the MEDIUM finding. No production source
   change is indicated by this review unless that proof reveals a real defect.

## Decision rationale

The product surface itself meets the design-system, real-DOM, structure, responsive
width, and `outcome_unknown` truthfulness checks. Approval is withheld solely because
the final evidence suite does not demonstrate the specific bounded-scroll behaviour
that `DESIGN.md` requires for long dialogs on a real 375px handset viewport.
