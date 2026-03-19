---
task: harden-magic-link-signin
timestamp_utc: 2026-02-19T15:44:01Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: high
flags: []
related_tickets: []
---

# Research: Public Magic-Link Hardening

## Requirements

- Functional:
  - Remove magic-link status leakage in `POST /api/auth/signin` by normalizing non-boundary outcomes to `202`.
  - Add anti-automation controls for guest/public magic-link flow (IP/global throttling + CAPTCHA).
  - Persist auth-send incident telemetry with hashed email/IP/UA and deterministic outcome labels.
- Non-functional:
  - Preserve existing password sign-in semantics.
  - Keep magic-link transport centralized in `server/auth/magic-link-email.ts`.
  - Avoid introducing new tables; use existing `observability_events`.

## Existing Patterns & Reuse

- Canonical signin boundary: `src/app/api/auth/signin/route.ts`.
- Shared rate limiting primitive: `server/security/rate-limit.ts` (`consumeRateLimit`).
- Shared observability writer: `server/observability.ts` (`recordObservabilityEvent`).
- IP extraction utilities: `server/security/request.ts`.
- Host classification support: `lib/auth/redirects.ts` (`parseHostname`).
- Email normalization helper: `server/customers.ts` (`normalizeEmail`).

## External Resources

- Cloudflare Turnstile verify endpoint: `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
- Supabase auth magic-link generation semantics already integrated via `auth.admin.generateLink`.

## Constraints & Risks

- Existing workspace has unrelated modified files; this task must keep diffs scoped.
- CAPTCHA verifier outages could block sign-in if fail-closed; route will log explicit outcome for fast diagnosis.
- Production requires new secrets (`TURNSTILE_SECRET_KEY`, `AUTH_AUDIT_HASH_SECRET`) and public site key.

## Open Questions (owner, due)

- None for this implementation pass; decisions are locked.

## Recommended Direction

- Implement boundary-first controls in `/api/auth/signin` with dedicated helpers for surface classification, throttling, and auditing.
- Enforce CAPTCHA only for public guest magic-link attempts.
- Suppress unknown-email sends while returning uniform `202` to avoid enumeration leakage.
