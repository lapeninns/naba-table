# Public Guest Design System

This is the working implementation guide for Nabatable homepage, public marketing pages, public booking pages, auth, and the guest portal.

The visual source of truth is the repo-root `GUEST_FACING_DESIGN_SYSTEM.md`, copied from `/Users/amankumarshrestha/NewShadcn/DESIGN.md` and named **Radix Luma**.

## Scope

Use this design system for:

- Homepage: `src/components/landing/**`
- Public marketing routes: `src/app/(public)/(marketing)/**`
- Public booking routes: `src/app/(public)/bookings/**`
- Guest portal routes: `src/app/guest/**`
- Guest/public reusable components: `src/components/guest/ui/**`

Do not use this design system for authenticated ops/dashboard surfaces under `src/app/app/**`. Ops should stay on the `app` theme.

## File Map

| Layer                    | Location                                          | Purpose                                                                                                    |
| ------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Public/guest tokens      | `styles/design-system/public-guest.tokens.css`    | Radix Luma color, type, rhythm, radius, elevation, and motion variables scoped to guest/public surfaces.   |
| Public/guest utilities   | `styles/design-system/public-guest.utilities.css` | Reusable Radix Luma `pg-*` classes for public sections, containers, cards, chips, typography, and motion.  |
| Public/guest bridge      | `styles/design-system/public-guest.bridge.css`    | Compatibility classes already used by guest pages, retuned to Radix Luma while surfaces migrate to `pg-*`. |
| Shared shadcn primitives | `components/ui/**`                                | Base Button, Card, Badge, Dialog, Sheet, Accordion, etc. Do not fork these for public pages.               |
| Public/guest compounds   | `src/components/guest/ui/**`                      | Reusable guest/public patterns composed from shadcn primitives and `pg-*` utilities.                       |
| Homepage composition     | `src/components/landing/**`                       | Homepage-specific sections, proof widgets, SEO, and landing-only data.                                     |
| Route wrappers           | `src/app/(public)/**`, `src/app/guest/**`         | Thin route composition only. Keep design logic in components and CSS layers.                               |

## Theme Boundary

The public/guest system is scoped to:

```css
[data-theme='guest'],
.guest-theme
```

Both `MarketingLayout` and `GuestLayout` set that boundary. Keep new public/guest styling inside that scope so ops remains unaffected.

## Naming Rules

- Use `pg-*` for public/guest design utilities.
- Use `--pg-*` for public/guest design tokens.
- Keep shadcn semantic tokens such as `--background`, `--primary`, and `--card` available for primitives.
- Do not add public/guest-only classes to global `:root` unless they are truly universal.

## Visual Direction

The public/guest system follows Radix Luma:

- Zinc neutral surfaces with light mode as the default.
- Cobalt blue (`#1447E6`) as the singular interactive accent.
- Merriweather for display and headlines.
- Inter for body, labels, forms, buttons, and navigation.
- Geist Mono for metadata, timestamps, and technical values.
- Dense, precise Apple-style spacing with 44px minimum touch targets.
- Subtle borders over resting card shadows; hover lift only for interactive elements.
- Motion that provides feedback and respects `prefers-reduced-motion`.

## Component Rules

- Start with shadcn/Radix primitives from `components/ui/**`.
- Build reusable public/guest compounds in `src/components/guest/ui/**`.
- Keep homepage-only layouts in `src/components/landing/**`.
- Do not create new primitive/base component systems outside `components/ui/**`.
- Prefer composition and small component props over one-off copied section markup.

## Migration Path

1. Add or update tokens in `public-guest.tokens.css`.
2. Add reusable layout/type/surface utilities in `public-guest.utilities.css`.
3. Keep compatibility-only classes in `public-guest.bridge.css` until their consuming pages have moved to `pg-*`.
4. Create shared public/guest compounds in `src/components/guest/ui/**` only when at least two guest/public surfaces need the pattern.
5. Refactor homepage sections to consume `pg-*` utilities and guest compounds.
6. Migrate public booking and guest portal pages surface by surface with browser proof.
7. Keep ops routes unchanged unless a separate ops design-system task is approved.

## Verification Expectations

For token-only or docs-only changes:

- Run static verification such as lint/typecheck.
- Browser proof can be omitted if there is no visual route consumption yet.

For visible UI migrations:

- Verify homepage, mobile width, and at least one affected guest/public route.
- Capture screenshots or equivalent artifacts in the task folder.
- Record whether `prefers-reduced-motion`, keyboard focus, and responsive behavior were checked.
