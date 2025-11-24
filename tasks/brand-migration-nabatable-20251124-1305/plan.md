---
task: brand-migration-nabatable
timestamp_utc: 2025-11-24T13:05:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Brand migration to Nab a Table / Lapen Inns

## Objective

Rebrand the platform from **SajiloReserveX** to **Nab a Table** with **Lapen Inns** as the parent/author identity, removing Shipfast/Marc references across code, metadata, and docs while preserving functionality and accessibility.

## Success Criteria

- [ ] All user-facing copy, metadata, and email senders show “Nab a Table” (parent mentions reference Lapen Inns where author/owner needed); no visible “SajiloReserveX”, “Shipfast”, or “Marc” branding remains in active surfaces.
- [ ] Core smoke tests (`pnpm test`, targeted lint/typecheck if lightweight) still pass.
- [ ] Manual UI QA on marketing landing (home), guest landing, and at least one auth/ops page confirms branding + no layout regressions.

## Architecture & Components

- `config.ts`: update `APP_NAME`, `appDescription`, `domainName`, email from names to Nab a Table/Lapen Inns; ensures downstream components inherit brand.
- `libs/seo.tsx`: swap Twitter creator + schema author to Lapen Inns; remove shipfast doc links; keep OG defaults.
- Marketing UI: update hardcoded brand strings in `src/app/page.tsx`, marketing components (GuestLandingPage, OwnerMarketing\*, MarketingSessionActions, etc.), and CSS tokens in `src/app/globals.css`.
- Testimonials/feature components (`components/Testimonials3/11`, `FeaturesGrid.tsx`): rewrite data to Lapen Inns/Nab a Table narratives.
- Docs/templates: update `README.md`, `docs/security.md`, `.env.example`, package metadata (`package.json`), and default email/test scripts (`test-email.mjs`, `libs/resend.ts`).
- Emails: replace literal brand strings in `server/emails/*` with config-driven names where missing.

## Data Flow & API Contracts

No API contract changes; branding flows through existing config and string literals only.

## UI/UX States

- All existing states should preserve layout; only text/metadata updates needed.

## Edge Cases

- Avoid replacing “Marc” substrings inside month names (“March”) or unrelated data fixtures.
- Ensure email fromNames stay ASCII-friendly; no special chars.
- If domain assumption (`nabatable.com`) differs, be ready to adjust quickly.

## Testing Strategy

- Run lightweight regression: `pnpm test` (existing vitest suite) if time permits; otherwise target lint/typecheck if tests are heavy.
- Manual UI QA via Chrome DevTools MCP on: home page (`/`), guest marketing page (testimonials), and an auth page to confirm title/metadata; check focus/keyboard quickly.
- Verify email preview via `pnpm test:ops`? (or use `pnpm test-email` route) not required unless quick.

## Rollout

- No feature flag; pure copy/metadata change.
- Ship via standard PR; rollback by reverting commit if branding issues reported.
- Monitor for broken links/metadata via browser console and simple Lighthouse if time allows.

## DB Change Plan (if applicable)

- N/A — no schema changes.
