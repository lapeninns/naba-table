# Nabatable brand

This file covers brand identity: the name, the logo and how the product speaks. Colour, type,
spacing, motion and components belong to the design system in [`DESIGN.md`](DESIGN.md). This
file does not repeat those values.

## Name

- Product: **Nabatable**. The public site uses this form (`BRAND_NAME` in
  `src/app/(public)/page.tsx`), and so does the logo lockup (`src/components/shared/BrandLogo.tsx`).
- Audience: food-led UK pubs and restaurants, and their guests.

> [!NOTE]
> **Open decision:** ops page titles and some older copy use **"Nab a Table"** (for example
> `Guests · Nab a Table Ops`). About 60 source files use each spelling. Until the owner picks one,
> use **Nabatable** in new copy and leave existing strings as they are.

## Logo

| Asset         | File                                       | Use                                            |
| ------------- | ------------------------------------------ | ---------------------------------------------- |
| Mark          | `public/brand/nabatable-logo.svg`          | Default app and site mark                      |
| Animated mark | `public/brand/nabatable-logo-animated.svg` | Hero or loading moments only (`animated` prop) |
| BIMI mark     | `public/brand/nabatable-bimi.svg`          | Email sender logo (see `scripts/email/`)       |

- Render the logo through the components: `<BrandLogo>` (mark + wordmark + optional "beta"
  tag) or `<BrandIcon>` (mark only), both in `src/components/shared/`. Do not hard-code an `<img>`
  or re-typeset the wordmark.
- `BrandLogo` has `variant="light"` for light surfaces and `variant="dark"` for dark or cobalt
  surfaces. It supports `size` `sm`, `md` and `lg`.
- Do not recolour, stretch, rotate or add effects to the mark. The only motion is the built-in
  hover tilt.

> [!NOTE]
> The mark SVG uses its own blue gradient (`#60A5FA` → `#1D4ED8`) and slate tones, not the Luma
> cobalt `#1447E6`. This is known and accepted. Do not copy the logo's colours into UI; UI colour
> comes only from Luma tokens.

## Voice

The product should sound calm, direct and competent. It should not sound excited or salesy.
The tone follows the visual system: restrained, professional, and "clinical yet warm"
(`DESIGN.md` → Brand & Style).

- **Guests:** keep it short and friendly, and put the next action first. Confirm what happened
  in plain words.
- **Operators (ops app):** use exact labels, not colour alone. Name the external effect of an
  action (`docs/design/ops-settings-contract.md` §7). Never present an uncertain outcome as
  success.
- **Terminology:** say "Booking", not "Reservation", in UI, URLs and APIs. "Reserve" is allowed
  only as a verb in marketing copy. The full rules are in
  [`docs/design-notes.md`](docs/design-notes.md).
- Use UK English spelling and date conventions.
- Never put guest personal data in copy examples. Use obvious placeholders.

## Not yet defined

These need an owner decision before anyone documents them: the final product-name spelling,
a tagline, a clear-space and minimum-size rule for the logo, and social or OG image templates.
