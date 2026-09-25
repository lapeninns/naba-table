# Radix Luma — design-system bundle

Registered as `user:radix-luma` (brand id `radix-luma-13f79a`). Primary source: the pasted
DESIGN.md (`designmd://radix-luma`), kept verbatim at `context/input-DESIGN.md`. Cross-checked
against the product repo it describes: `~/LapenInns Project/platform/naba-table` at commit
`34821bed8` (25 Sep 2026). Every value is **measured** from those sources unless marked _inferred_.

## Manifest

| Path                                  | Owner         | What it is                                                                                                                                                                                  |
| ------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brand.json`                          | hand-authored | Source of truth for the engine: 7 roles, type, voice, imagery, logo, layout rules, `seed`                                                                                                   |
| `tokens.css`                          | hand-authored | **Source-exact CSS tokens, light + dark, guest + app.** Use this for real work                                                                                                              |
| `components.html`                     | hand-authored | Component kit: guest/app surface switch, light/dark (`d`), real logo and fonts                                                                                                              |
| `fonts/`                              | copied        | Self-hosted latin woff2: Merriweather 700, Inter variable 400–700, Geist Mono 400 + `radix-luma-latin.css` + OFL licences (engine also writes a Vietnamese-only `fonts.css`; do not use it) |
| `logos/`                              | copied        | Real Nabatable marks from `naba-table/public/brand/` (static, animated, BIMI)                                                                                                               |
| `imagery/`                            | copied        | Component renders from `naba-table/ds-bundle/_screenshots/` (20 Jul 2026)                                                                                                                   |
| `BRAND.md`                            | hand-authored | Identity: name, logo, voice (summarised from the repo's BRAND.md)                                                                                                                           |
| `README.md`, `SKILL.md`               | hand-authored | This reference and the agent usage guide                                                                                                                                                    |
| `context/input-DESIGN.md`             | source        | The pasted DESIGN.md, unmodified                                                                                                                                                            |
| `context/brand.programmatic.json`     | archive       | First programmatic pass (wrong accent), kept for provenance                                                                                                                                 |
| `DESIGN.md`, `guide.md`, `brand.html` | generated     | Rendered from `brand.json` by `od brand preview/finalize`                                                                                                                                   |
| `system/*`                            | generated     | Engine seed, tokens, CSS variables, kits and artifact previews                                                                                                                              |

Do not edit `system/`, `DESIGN.md` or `guide.md` by hand. Change `brand.json`, then run
`od brand finalize radix-luma-13f79a`. Finalize leaves the hand-authored files alone.

## What changed and why

| Field                    | Before                  | Now                                             | Evidence                                                           |
| ------------------------ | ----------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| accent                   | `#223300` "Button glow" | `#1447e6` cobalt                                | The old value was a parse artefact of the `button-glow` shadow key |
| muted                    | `#f4f4f5` (a fill)      | `#71717b` muted text                            | shadcn `muted-foreground`                                          |
| surface                  | `#f5f5f5`               | `#f4f4f5` Zinc-100                              | "Zinc-100 tonal layers"                                            |
| logo                     | none                    | `logos/nabatable-logo.svg` + 2 alternates       | repo `BRAND.md`, `BrandLogo.tsx`                                   |
| fonts                    | not bundled             | `fonts/` + `googleFontsUrl` per face            | weights from `src/app/layout.tsx`                                  |
| success / warning / info | engine defaults         | `#16a34a` / `#f59e0b` / `#0ea5e9`               | `public-guest.tokens.css` (HSL 142 76% 36% etc.)                   |
| dark palette             | engine-derived only     | source-exact in `tokens.css`                    | repo `.dark` block                                                 |
| guest vs app shape       | not shown               | `components.html` surface switch                | DESIGN.md → Shapes                                                 |
| voice                    | generic                 | UK English, Nabatable name, Booking terminology | repo `BRAND.md`                                                    |

## Colour tokens

| Role                     | Light                                    | Dark                                      | shadcn source              |
| ------------------------ | ---------------------------------------- | ----------------------------------------- | -------------------------- |
| background               | `#ffffff`                                | `#09090b`                                 | background                 |
| card / popover           | `#ffffff`                                | `#18181b`                                 | card, popover              |
| surface                  | `#f4f4f5`                                | `#27272a`                                 | secondary, muted, accent   |
| foreground               | `#09090b`                                | `#fafafa`                                 | foreground                 |
| muted                    | `#71717b`                                | `#9f9fa9`                                 | muted-foreground           |
| border                   | `#e4e4e7`                                | `rgb(255 255 255 / .1)` · input `#3f3f46` | border, input              |
| primary fill             | `#1447e6` (hover `#1240cf`)              | `#193cb8` (hover `#1447e6`)               | primary, label `#eff6ff`   |
| cobalt as text / focus   | `#1447e6`                                | `#2b7fff`                                 | repo `--pg-cobalt` in dark |
| accent-secondary         | `#18181b`                                | `#fafafa`                                 | secondary-foreground       |
| destructive              | `#e7000b`, button `#c10007` on `#fef2f2` | `#ff6467`                                 | destructive                |
| success / warning / info | `#16a34a` / `#f59e0b` / `#0ea5e9`        | `#22c55e` / `#f59e0b` / `#0ea5e9`         | repo status tokens         |

Chart ramp: `#8ec5ff` `#2b7fff` `#155dfc` `#1447e6` `#193cb8`. Sidebar: `#fafafa` / `#18181b`,
active `#155dfc` / `#2b7fff`.

**Measured contrast (WCAG 2):**

| Pair                              | Ratio                   | Result                                                                                    |
| --------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| foreground on background          | 19.9:1 (dark 19.1:1)    | pass                                                                                      |
| cobalt text on white              | 6.8:1                   | pass                                                                                      |
| `#eff6ff` on primary              | 6.3:1 (dark fill 8.1:1) | pass                                                                                      |
| muted on white                    | 4.8:1                   | pass                                                                                      |
| muted on Zinc-100                 | 4.4:1                   | **fails** for small text                                                                  |
| dark `#193cb8` on `#09090b`       | 2.3:1                   | **fails**, so dark text and focus use `#2b7fff` (5.3:1)                                   |
| white on success / warning / info | 3.3 / 2.1 / 2.9:1       | **fail**, so badges use tint + deep text: success 4.8:1, warning 4.8:1, destructive 5.9:1 |
| ring `#9f9fa9` on white           | 2.6:1                   | **fails**, so focus adds a 2px cobalt outline                                             |

## Type, space, shape, depth, motion

- **Type:**
  - display 48/56 −0.02em, headline-lg 36/44, headline-md 24/32 (Merriweather 700, guest only, `clamp()`)
  - title-lg 20/28 600, body 18 / 16 / 14, label 14 / 12 500
  - eyebrow 12/16 600 +0.08em, button 14/20 600 +0.01em
  - mono Geist Mono 12/16
  - App surface: Inter for all headings, 14px body.
- **Spacing:** 4 · 8 · 16 · 24 · 40 · 64 · 96 · 128. Container padding 24 → 48 → 96px.
- **Radius:** 6 · 8 · 10 · 12 · 14 · 16 · 20 · pill. Guest buttons are pill-shaped; app buttons use 8px.
- **Shadows** (Zinc-950 tinted): sm, default, md, lg, nav-float, button-glow, popover. Values are in `tokens.css`.
- **Motion:**
  - Easing: default `(.25,.1,.25,1)`, spring `(.22,1,.36,1)`, bounce `(.34,1.56,.64,1)`.
  - Durations: 150 / 250 / 500 / 800ms.
  - The engine seed uses `motionUnit 0.125`, so its mid step matches 250ms.

## Drift found in the product (for the repo owner)

These were seen in the ds-bundle renders in `imagery/` (20 Jul 2026). They are recorded here,
not copied into this system:

1. **Destructive buttons.** "Mark no-show" and "Cancel reservation" render as solid red with dark
   text. DESIGN.md specifies a `#fef2f2` tint with `#c10007` text.
2. **Terminology.** Sample copy says "Your reservation" and "Cancel reservation". The repo's BRAND.md
   requires "Booking".
3. **Pending badge.** Its amber text on the amber tint looks low-contrast. This system uses the
   `#b45309` on `#fffbeb` pair (4.8:1).

## Still open (needs an owner decision, not more extraction)

- **Product name:** Nabatable or "Nab a Table". The repo marks this as an open decision. New copy uses Nabatable.
- **Logo:** no clear-space or minimum-size rule, and no tagline, social or OG templates. The repo says these are "not yet defined".
- **Engine limits:**
  - The generated `system/kit.dark.html` and `system/variables.dark.css` still derive dark from the light seed. The engine has no dark-override hook.
  - The generated kits show only one radius.
  - The source-exact dark palette and both surfaces are in `tokens.css` and `components.html`. Use those.
