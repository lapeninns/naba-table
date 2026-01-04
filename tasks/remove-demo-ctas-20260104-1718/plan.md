# Plan: Remove Demo CTAs

## Objective

Remove all "Book a Demo" / "Schedule Demo" Call-to-Action elements from the landing page to comply with the request to disable the demo flow.

## Success Criteria

- [ ] No "Get A Demo" buttons visible on the landing page.
- [ ] `StickyCTA` (floating demo button) is removed.
- [ ] `ExitIntentPopup` (demo popup) is disabled/removed.
- [ ] Layout remains broken (no empty gaps looking weird).

## Architecture & Components

### `src/components/landing/LandingPage.tsx`

- Remove `<StickyCTA />`
- Remove `<ExitIntentPopup />` (or comment out/remove import)

### `src/components/landing/sections/HeroSection.tsx`

- Remove the "Get A Demo" button from the button group.
- Keep "Contact Sales" if present, or leave empty if it's the only button (it seems "Contact Sales" is also there).

### `src/components/landing/sections/CTASection.tsx`

- Remove the "Get A Demo" button.
- Keep "Contact Sales".

## Data Flow & API Contracts

No API changes.

## Testing Strategy

- Manual verification via reading the code (as I cannot see the rendered UI).
- `grep` to ensure no "Get A Demo" strings remain in the used components.

## Rollout

- Direct code modification.
