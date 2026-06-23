# Floor Plan — UX/UI Audit Brief (shared context)

You are auditing the **ops floor-plan** page. This brief gives you the rendered-state
evidence (you cannot see the screenshots the orchestrator captured) plus the source map
and harness caveats. Combine this with your own reading of the source files.

## What the page is

A live "service-view" floor plan for restaurant staff: seat / clear / combine / rearrange
tables on a zoomable map, with a time-scrubber to replay the service window. It is an
**ops** surface (staff-facing, often on tablets/phones at the host stand), not a guest page.

Route (production): `src/app/app/(app)/floor-plan/page.tsx` → `FloorPlanClient` →
(loading | error | empty | ready) → `FloorPlanShell`.

## Source files to review (all under src/components/features/floor-plan/ unless noted)

- `FloorPlanClient.tsx` — load/error/empty/ready branches + loading skeleton.
- `FloorPlanShell.tsx` — composition: header, cockpit, map card, legend filter, scrubber, detail panel; desktop aside vs mobile sheet split at `lg` (1024px).
- `FloorPlanHeader.tsx` — h1 venue name + summary line + "Service operational" badge + Refresh.
- `FloorPlanCockpit.tsx` — the 3 stat tiles (Covers seated / Booked ahead / Tables open).
- `FloorPlanCanvas.tsx` — the zoomable/pannable map viewport; projects nodes; grid bg; touch-action.
- `TableNode.tsx` — a single table button (status tint + dot + label; drag-to-move; aria-label).
- `FloorPlanZoomControls.tsx` — +/−/fit + zoom %.
- `ZoneRegionsLayer.tsx`, `JoinOverlay.tsx` — dashed zone regions, join brackets/links, could-join hints.
- `FloorPlanLegendFilter.tsx` — the "Filter tables by status" chip group.
- `TimeScrubber.tsx` — play/pause + slider "Service time" + LIVE NOW / SEATED / BOOKED readout.
- `FloorPlanDetailPanel.tsx` — aside (lg) / bottom Sheet (<lg) wrapper; shows TableDetailView when a table is selected, else ZoneOccupancySummary.
- `TableDetailView.tsx` — selected-table detail + actions (Seat / Clear / No-show / Split / Join).
- `ZoneOccupancySummary.tsx` — per-zone occupancy bars (default aside state).
- `serviceStateStyles.ts` — `nodeSurfaceClass` / `nodeDotClass` per service state.
- `domain/types.ts` — `ServiceState` (7 states) + `SERVICE_STATE_META` (label/tone/booked/occupied) + ordering. Note the doc contract: "rendered as a colour dot AND a label — never colour alone".
- `domain/serviceState.ts` — resolves a table's live state at time T.
- `useFloorPlanState.ts` — the state hook (selection, spotlight filter, scrub/play, drag, stats, legend, derived view models).
- `useFloorPlanViewport.ts` + `domain/viewport.ts` — zoom/pan math.
- `domain/project.ts` / `domain/layout.ts` / `domain/joins.ts` / `domain/zones.ts` — pixel projection + layout + join + zone geometry.

## Design system (verified, do not re-litigate)

- Ops theme is `[data-theme='app']`: **light-only**, cobalt primary. Tokens (computed, HSL):
  - `--primary: 227 84% 49%` (cobalt ≈ #1646e0) — used for selected ring, primary CTAs, filter active.
  - `--destructive: 357 100% 45%` (red) — overdue / danger tone.
  - `--ring: 240 5% 64%` (mid-gray) — the focus-visible ring color.
  - `--border: 240 6% 90%`, `--muted/accent: 240 5% 96%`, `--card/background: 0 0% 100%`.
- Dark mode does NOT apply to ops (`.dark` class and `prefers-color-scheme` both no-op inside `[data-theme=app]`). Treat ops as light-only **by design** — do NOT file "no dark mode" as a bug.
- globals.css enforces a **44×44px minimum on all buttons** (sidebar exempted). So raising button
  heights for touch is a no-op; only non-button hit areas (slider track) and **transform-scaled**
  elements (zoomed-down table tiles) can fall below 44px.

## Rendered-state evidence (from live capture at localhost:3000/dev/ops-floor-plan)

### Desktop (1280×900) — 2-column layout (map left, sticky aside right)

- Header: big h1 "The Brasserie (Dev)", summary "13 tables · 3 zones · 46 covers ·", a cobalt-outline
  "Service operational" badge, and a "Refresh" button (top-right).
- Cockpit: 3 equal stat tiles — **28** Covers seated / "of 46 · 61% capacity"; **10** Booked ahead /
  "2 tables held"; **4** Tables open / "ready to seat".
- Map card: title "Floor map" + right-aligned "Showing 20:30" (19:30 UTC rendered in Europe/London BST — DST correct). Zoom controls (+/−/fit) stacked top-right over the canvas, with a "100%" chip.
- Canvas: dashed zone regions labeled "MAIN DINING · 8", "TERRACE · 2", "BAR · 3"; 13 table tiles with
  status tint + a small colored status dot + number + sublabel (customer name / time / "N cov").
  Tables 5 & 6 wrapped by a cobalt "JOINED · 8 SEATS" bracket.
- Below the map: a "SERVICE STATES" strip ("4 open · 61% seated capacity") + a "FILTER" chip group
  (Seated 4 / Finishing 1 / Walk-in 1 / Overdue 1 / Confirmed 1 / Held 1 / Free 4), then a Separator,
  then the TimeScrubber (play button, "20:30 LIVE NOW", "28 SEATED · 10 BOOKED", a slider).
- Aside (default, nothing selected): "Service overview" h2 + "Live zone load for the current service
  window." + "OCCUPANCY BY ZONE" + per-zone bars (Main dining 24/34, Terrace 2/6, Bar 2/6).

### Desktop — table selected (clicked Table 5)

- Aside swaps to TableDetailView: "MAIN DINING" eyebrow, big "5" + "4 seats", "Seated" badge,
  tag row (Standard / Movable / Main dining), booking block "Goldberg" + "7 COVERS · 20:15",
  a cobalt-tinted "JOINED · T5 + T6 · 8 SEATS" box containing a **"Split tables"** control,
  a "COMBINE WITH" label + "Join 7" button, and a full-width cobalt **"Clear table"** CTA.
- On the canvas the selected tile gets a cobalt ring + lift; a dashed "could-join" hint line is
  drawn from Table 5 to the free Table 7.

### Desktop — status filter active (clicked "Overdue")

- All tiles except the single Overdue table (Table 4) drop to ~30% opacity (dimmed). The join
  bracket stays drawn. (A "Showing <state>" clear-pill is rendered in the SERVICE STATES strip.)

### Narrow desktop / large tablet (~846px, below lg) — single column

- Aside collapses; map goes full width; detail panel becomes a bottom Sheet on selection.

### Mobile (375×812)

- Everything stacks to 1 column. The "Service operational" badge wraps to its own line, leaving a
  **dangling "·" separator** after "46 covers" on the line above.
- "Refresh" becomes a full-width button.
- The **3 stat tiles stack into 3 very tall (~220px each) full-width cards** (~660px+ total), so the
  Floor map — the primary content — starts ~1090px down the page (well below the fold; lots of scrolling).
- Map opens at **50% zoom** by default → tiles render ~half size (e.g., 46px high-tops → ~23px), i.e.
  **below the 44px touch target** until the user pinch-zooms. Tap-slop (12px on touch) + pinch-zoom
  (`touch-action: pan-y pinch-zoom`) are the only mitigations.
- Selecting a table opens a bottom Sheet: dimmed backdrop, rounded top, same detail content, full-width
  cobalt "Clear table" pinned near the bottom with safe-area padding. Looks polished.

## Accessibility tree facts (from the live a11y snapshot)

- Every table tile is a `button` with a full label, e.g. `"Table 1, 2 seats, Seated"` (status in the
  name, not color-only) — good. Selected adds ", selected" and `aria-pressed`.
- Zoom controls labeled "Zoom in" / "Zoom out" / "Fit to view". Filter is a `group` "Filter tables by status".
- TimeScrubber: a `button` "Play service replay" and a `slider` "Service time" — **but the slider's
  exposed value is a raw epoch-ms number `1782243000320`** (no human-readable `aria-valuetext`). A screen
  reader announces the millisecond integer. Likely missing aria-valuenow scaling / aria-valuetext / valuemin/max.
- Heading hierarchy is sparse: only h1 (venue) and h2 ("Service overview"). The stat tiles, "Floor map",
  "Service states", and zone names are plain StaticText, not headings — weak document outline / landmarks.
- Stat tiles read as loose StaticText ("28" / "Covers seated" / "of 46 · 61% capacity") with no grouping
  or accessible name tying the number to its label.
- Focus-visible ring uses `--ring` (mid-gray `240 5% 64%`) — low contrast against white tiles; selected
  uses cobalt but keyboard focus is the gray ring.
- Two duplicate "Notifications alt+T" toast regions (minor; from the toaster).

## Hard metrics (desktop, 100% zoom)

- No interactive element < 44px at 100% zoom. Table tiles range 46×46 (high-tops) → 110×82 (private room).
- No horizontal overflow at 375 or 1280 (`scrollWidth == innerWidth`).
- Console: clean (no warnings/errors).

## HARNESS CAVEATS — these are mock artifacts, NOT bugs in the page. Do not report them:

- This was rendered via a dev-only harness (`src/app/(public)/dev/ops-floor-plan/`) that mounts the REAL
  `FloorPlanShell` with hand-laid mock data (`ui/mockFloorPlan.ts`).
- The TimeScrubber **Play** and all booking actions (Seat/Clear/No-show/Split/Join), Refresh, and drag-commit
  are wired to no-ops in the harness — do not evaluate their runtime behavior; review the SOURCE for those.
- `zones` occupancy numbers in the aside are hand-set constants (kept consistent with the cockpit), not
  computed from segments. Don't audit the zone math from the render; read `domain/zones.ts`.
- Mock tables carry empty `segments[]`; live state was injected directly. So the scrubber doesn't actually
  change tile states in the harness. Review time/state resolution in `domain/serviceState.ts` from source.
- The venue name "The Brasserie (Dev)" and the "(Dev)" suffix are harness-only.

## Scope

Audit the page's **UX and UI quality**: visual hierarchy & layout, interaction & affordances, responsive
behavior (esp. mobile/tablet — this is a service device), accessibility, design-system consistency, content
& microcopy, and states (loading/empty/error/edge). Each finding must cite specific file(s)+line(s) from
source and say WHY it matters to a host/server using this during service, plus a concrete fix.
