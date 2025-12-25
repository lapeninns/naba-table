---
task: session-recovery-token-crud
timestamp_utc: 2025-12-25T12:46:33Z
owner: github:@maintainers
reviewers: [github:@web-core]
risk: high
flags: []
related_tickets: []
---

# Research: Guest Booking CRUD via Session Recovery Access Token

## Problem Statement

Guests can currently view a booking detail page via a per-booking confirmation token (`?token=...`), but they **cannot** reliably update/cancel their booking without an authenticated session.

We want the **new HMAC “session recovery access token”** (see `server/security/session-recovery-access-token.ts`) to be the primary mechanism used by guest-facing links (e.g. confirmation email “Manage booking”) to enable guest **CRUD** actions (read/update/cancel) without requiring an account login.

## Requirements

- Functional:
  - Confirmation/manage links issued to guests should use the **HMAC access token** mechanism.
  - Clicking the link should allow the guest to **view**, **edit**, and **cancel** the booking (subject to existing cutoffs / pending locks / past-time rules).
  - Token auth should work consistently across:
    - booking detail reads (`GET /api/bookings/[id]`)
    - booking updates (`PUT /api/bookings/[id]`)
    - booking cancellations (`DELETE /api/bookings/[id]`)
    - booking list lookups (`GET /api/bookings`) where applicable
- Non-functional:
  - No secrets committed; token signing secret is env-driven.
  - Avoid leaking sensitive data in logs/errors.
  - A11y: booking detail “manage” actions remain keyboard accessible.
  - Keep behavior backward compatible where reasonable (existing confirmation token links should still render).

## Existing Patterns & Reuse

- HMAC token helpers exist: `server/security/session-recovery-access-token.ts`.
- Env plumbing exists: `SESSION_RECOVERY_ACCESS_TOKEN_SECRET`, `SESSION_RECOVERY_ACCESS_TOKEN_TTL_SECONDS` in `config/env.schema.ts` + `lib/env.ts`.
- Guest booking detail already supports public read-only access via confirmation token:
  - `GET /api/bookings/[id]?token=...` and cookie `sr_confirm`.
- To reduce URL leakage, project already uses an **ephemeral httpOnly cookie** pattern:
  - `sr_confirm` is set on booking create and consumed by `/api/bookings/confirm`.

## Constraints & Risks

- **High risk:** granting unauthenticated update/cancel needs strict server-side authorization checks.
- Token TTL must be long enough for email-driven usage (guests often modify bookings days later).
- Token is currently a signed (not encrypted) payload; avoid unnecessary exposure and avoid logging tokens.
- Must not break ops/dashboard flows that rely on the same endpoints and components.

## Open Questions (owner, due)

- Q: Should a single token grant access across multiple restaurants, or remain restaurant-scoped?
  - A (assumption): keep restaurant-scoped (existing token payload includes `restaurantId`).
- Q: Should confirmation-token links also gain manage ability, or only HMAC tokens?
  - A (assumption): HMAC is primary; confirmation-token remains read-only for now (unless required for compatibility).

## Recommended Direction (with rationale)

- Generate a session recovery access token in the booking confirmation email and link to a **token-capture route** that stores it in an **httpOnly cookie** and redirects to the booking detail page.
  - Minimizes token exposure in subsequent navigation and API calls.
- Update booking APIs to accept the access token via **cookie / header / query**, validate it, and authorize actions by verifying the booking belongs to the token’s (restaurantId + email + phone) identity.
