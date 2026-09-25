---
name: radix-luma
description: Apply the Radix Luma design system (Zinc neutrals, single cobalt accent, Merriweather + Inter + Geist Mono) to Nabatable guest pages and ops dashboards.
---

# Using Radix Luma

1. **Load the assets in this order:** `fonts/radix-luma-latin.css`, then `tokens.css`. Use only `var(--…)` tokens and never
   write colour literals in components. `components.html` is the working reference for every component.
2. **Pick the surface** with `data-theme` on `<html>`:
   - `guest` (public booking pages): Merriweather 700 headings, capsule buttons, roomy rhythm.
   - `app` (ops console): Inter everywhere, 14px body text, 8px controls, compact cards.
3. **Dark mode:** add `.dark`. Light is the default. Toggle with `d` and store the choice. In dark mode, cobalt text and
   focus use `--accent-text` (`#2b7fff`); `#193cb8` is for fills only.
4. **Cobalt is for interaction only.** Use one filled primary per view, plus links, active states and focus.
   Never use it for decoration, washes or headings.
5. **Depth comes from borders.** Cards use `--card`, a 1px `--border` and a 12px radius, with no resting shadow.
   Only popovers and floating chrome get shadows.
6. **Status:** use tint + deep-text badges, always with a word or an icon. Solid success, warning and
   info colours never carry small white text.
7. **Logo:** use `logos/nabatable-logo.svg` unchanged, with the bold Inter "Nabatable" wordmark.
   Never draw a substitute mark.
8. **Copy:** UK English. Say "Booking", not "Reservation". Don't use exclamation marks. Never show an
   uncertain outcome as success.
9. **Before shipping, check:**
   - Text contrast is at least 4.5:1. Muted text on `--surface` needs 14px/500 or larger.
   - Focus outlines are visible.
   - Hit areas are 44px.
   - There's no horizontal overflow from 320px.
   - `prefers-reduced-motion` is honoured.

Engine source of truth: edit `brand.json`, then run `od brand finalize radix-luma-13f79a`. That regenerates
`DESIGN.md`, `guide.md` and `system/`, and leaves `tokens.css`, `components.html`, `fonts/`, `logos/` and `imagery/` untouched.
