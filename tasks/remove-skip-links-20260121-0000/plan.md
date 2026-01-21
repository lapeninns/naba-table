# Plan: Remove Skip Links

## Objective

Remove all "Skip to content" links and related UI elements from the app to comply with the task requirements.

## Success Criteria

- [ ] `src/app/layout.tsx`: Root skip link removed.
- [ ] `src/components/layouts/GuestNavbar.tsx`: Navbar skip link removed.
- [ ] `src/components/landing/LandingPage.tsx`: `SkipLinks` component usage removed.
- [ ] `src/components/landing/seo/SkipLinks.tsx`: File deleted.
- [ ] `src/components/landing/seo/index.ts`: Export removed.
- [ ] CSS files (`globals.css`, `base.css`): `.skip-link` styles removed.
- [ ] Application compiles without errors.

## Architecture & Components

- **Removal**: This is a removal task, no new architecture.

## Testing Strategy

- **Static Analysis**: Use `lsp_diagnostics` to ensure no broken imports or syntax errors.
- **Verification**: Check files to ensure removal is clean.

## Rollout

- Immediate deployment upon merge.
