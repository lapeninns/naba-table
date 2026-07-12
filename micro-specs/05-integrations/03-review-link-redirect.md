---
spec_id: MS-integrations-review-link-redirect
status: draft
risk_class: auth-session
owner: codex
last_reviewed: 2026-07-12
allowed_blast_radius:
  - micro-specs/05-integrations/**
  - cloudflare/booking-short-links/**
  - server/bookings/short-link.ts
  - tests/cloudflare/booking-short-links.test.ts
  - tests/cloudflare/booking-short-links-storage.test.ts
  - tests/server/bookings/short-link.test.ts
implementation_surfaces:
  - cloudflare/booking-short-links/**
  - server/bookings/short-link.ts
  - tests/cloudflare/booking-short-links.test.ts
  - tests/cloudflare/booking-short-links-storage.test.ts
  - tests/server/bookings/short-link.test.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - not-yet-created
verification_gates:
  - pnpm governance:check
  - pnpm test
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm qa:background-workers
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-integrations-review-link-redirect — Purpose-scoped review link redirect

## 1. Exact Goal and User-Visible Outcomes

The native **Leave a review** WhatsApp button opens an actual Nabatable HTTPS link that resolves
only to the intended venue's validated Google review destination. Booking-management links keep
their existing behavior and cannot be exchanged for review links.

## 2. Blast Radius

In scope are the existing booking-short-links Worker contract, storage, resolver, server-side app
client, and focused tests listed above. Out of scope are booking-management authorization,
provider dispatch, consent, review scheduling, schema outside the Worker store, UI, and Google API
writes.

## 3. Strict Constraints and Assumptions

- Review links use the existing `https://go.nabatable.com` service and opaque tokens.
- Link purpose and destination are server-controlled; callers cannot supply a redirect at resolve
  time, and the public response never exposes internal credentials or booking/customer data.
- Only validated HTTPS Google review destinations are storable and resolvable. Unsafe, malformed,
  non-HTTPS, non-Google, missing, expired, or wrong-purpose records fail closed.
- Internal creation remains authenticated by the Worker's existing server-to-server boundary.

## 4. Decisions Already Made

- Review and booking-management links are distinct purposes in one Worker, not interchangeable
  URL shapes or a generic open redirect.
- The WhatsApp CTA URL is the public short link itself; visible body text is not a substitute.
- A venue's current allowlisted Google review URL is snapshotted when the review link is created.
- Redirect responses reveal no reason that would help enumerate valid tokens.

## 5. Behavioral Requirements (EARS)

- WHEN an authenticated app client requests a review link, THE Worker SHALL create or reuse an
  opaque purpose=`review` record for the supplied validated HTTPS Google review destination.
- WHEN a valid unexpired review token is opened, THE Worker SHALL redirect to its stored Google
  review destination without exposing internal data.
- IF a destination is not an allowed HTTPS Google review URL, THEN THE app client and Worker SHALL
  refuse creation without storing a record.
- IF a token is missing, expired, unknown, malformed, or has another purpose, THEN THE Worker SHALL
  fail closed and SHALL NOT redirect to any caller-controlled location.
- WHEN a booking-management token is resolved, THE Worker SHALL preserve its existing management
  behavior and SHALL NOT resolve it as a review link.

## 6. Verification Criteria and Task Breakdown

- Prove review creation and redirect through the Worker request surface with an allowed URL.
- Prove unsafe destinations, wrong-purpose tokens, expiry, tampering, and missing internal auth fail.
- Prove existing booking-management create/reuse/resolve behavior remains unchanged.
- Implement as Red → Green → Refactor slices for contracts, storage, resolver, and app client.
- Record fresh gates with `governance:run-gates --spec MS-integrations-review-link-redirect --record`.
