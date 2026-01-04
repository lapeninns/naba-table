---
task: brand-auth-final-cleanup
timestamp_utc: 2026-01-04T16:00:00Z
owner: github:@opencode
---

# Implementation Checklist

## Setup

- [x] Create task folder
- [ ] Update `CONTINUITY.md`

## Auth Cleanup

- [ ] Update `config.ts` `loginUrl` to `/auth`
- [ ] Search and replace `href="/login"` with `href="/auth"` in TSX/JSX
- [ ] Audit remaining `/login` occurrences

## Brand Standardization

- [ ] Search for `<svg` with specific paths or text like "Nab a Table"
- [ ] Replace hardcoded instances with `<BrandLogo />`
- [ ] Verify `OwnerMarketingNavbar.tsx`

## Verification

- [ ] Run linting
- [ ] Manual check of navigation links
