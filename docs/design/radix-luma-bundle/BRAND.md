# Nabatable — brand identity (Radix Luma)

This file covers name, logo and voice. Colour, type, space and components are in `README.md`, `tokens.css`
and the generated `DESIGN.md`. It is summarised from `naba-table/BRAND.md` (commit `34821bed8`).

## Name

- Product: **Nabatable**. Audience: food-led UK pubs and restaurants, and their guests.
- "Nab a Table" still appears in ops titles and older copy. The owner hasn't decided between the two
  spellings yet. Use Nabatable in new copy and leave existing strings as they are.

## Logo

| Asset         | File                                | Use                                     |
| ------------- | ----------------------------------- | --------------------------------------- |
| Mark          | `logos/nabatable-logo.svg`          | Default app and site mark (512×512 SVG) |
| Animated mark | `logos/nabatable-logo-animated.svg` | Hero or loading moments only            |
| BIMI mark     | `logos/nabatable-bimi.svg`          | Email sender logo only                  |

- **Lockup:** mark + bold Inter "Nabatable", 8px gap. Mark sizes are 32, 40 and 80px. Use `variant="light"` on light
  surfaces and `variant="dark"` on dark or cobalt surfaces. There's an optional "beta" tag.
- **Don't** recolour, stretch or rotate the mark, and don't add effects. The only motion is the built-in hover tilt.
- **Logo colours stay in the logo.** The mark's own gradient (`#60A5FA` → `#1D4ED8`) and slate tones are accepted as they are.
  Never copy those colours into the UI; UI colour comes only from Luma tokens.
- **Not yet defined:** clear space, minimum size, tagline, social and OG templates.

## Voice

Calm, direct and competent. Never excited or salesy. The tone is restrained and "clinical yet warm".

- **Guests:** keep it short and friendly, and put the next action first. Confirm what happened in plain words.
- **Operators:** use exact labels, never colour alone. Name the external effect of an action, and never
  present an uncertain outcome as success.
- **Terminology:** "Booking", not "Reservation", in UI, URLs and APIs. "Reserve" is only allowed as a verb in
  marketing copy.
- Use UK English spelling and dates (Saturday 14 June).
- Never put guest personal data in examples. Use obvious placeholders (Guest A, BR-0000).
