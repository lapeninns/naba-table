---
task: auth-brand-cleanup
timestamp_utc: 2026-01-04T13:00:00Z
owner: github:opencode
risk: low
---

# Implementation Checklist

## Documentation

- [ ] Update `docs/restaurant-facing-routes.md` to use `/auth` instead of `/login`.

## Implicit Auth

- [ ] Review `components/auth/ImplicitAuthHandler.tsx`.

## Brand Consistency

- [ ] Grep for hardcoded legacy logo SVG paths (`M256 32C150...`).

## Link/Button Verification

- [ ] Check `FactoryHomeClient` for nested `<a>` tags.
- [ ] Check `factory-landing/page.tsx` for nested `<a>` tags.
