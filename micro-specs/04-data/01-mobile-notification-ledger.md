---
spec_id: MS-data-mobile-notification-ledger
status: active
risk_class: migrations
owner: codex
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/04-data/**
  - supabase/migrations/**
  - supabase/tests/**
  - tests/micro-specs/mobile-notification-ledger.test.ts
  - types/supabase.ts
implementation_surfaces:
  - supabase/migrations/**
  - supabase/tests/**
  - tests/micro-specs/mobile-notification-ledger.test.ts
  - types/supabase.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - not-yet-created
verification_gates:
  - pnpm governance:check
  - pnpm test:micro-specs
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm qa:background-workers
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-data-mobile-notification-ledger — Channel-neutral mobile notification ledger and fallback claims

## 1. Exact Goal and User-Visible Outcomes

Nabatable has durable, tenant-attributable records for each logical mobile notification and
each WhatsApp or SMS delivery attempt, so a WhatsApp failure can claim at most one SMS fallback
without losing the existing SMS history. Booking and manager WhatsApp consent is stored as
versioned evidence tied to the exact phone number that was approved.

## 2. Blast Radius

In scope: idempotent migrations, generated Supabase types, real-database invariant tests, and focused contract tests for
booking/manager consent evidence, logical notification identity, attempt status, and atomic
fallback claims. Out of scope: provider HTTP calls, callback routes, UI, existing SMS-row
rewrites, production data backfill, and destructive contraction of `sms_delivery_log`.

## 3. Strict Constraints and Assumptions

- Existing SMS rows remain readable and unchanged.
- Consent and recipient fields are customer PII and remain service-role or tenant scoped.
- Migrations are expand-only, idempotent, remote-only, and staging-first.
- Database time determines claim timestamps.
- Fallback eligibility is enforced atomically in Postgres, not by read-then-write application code.

## 4. Decisions Already Made

- A logical mobile notification is distinct from its channel attempts.
- A logical key identifies one restaurant, recipient event, and notification type.
- Booking consent is per booking and per normalized phone snapshot; it is never inherited from
  `marketing_opt_in` or a previous booking.
- Guest consent source is `guest_reserve`; staff consent source is `ops_staff` and includes the
  authenticated actor. Manager consent is recorded separately on the restaurant.
- A logical notification may have one WhatsApp attempt and at most one SMS attempt.

## 5. Behavioral Requirements (EARS)

- THE data model SHALL persist a logical mobile notification separately from provider attempts.
- THE data model SHALL attribute each notification and attempt to `restaurant_id` and retain its
  notification type, channel, recipient, provider identifier, status, timestamps, and fallback
  relationship.
- THE data model SHALL enforce uniqueness for the logical notification key and for each channel
  attempt within that notification.
- THE booking consent record SHALL include enabled state, normalized phone snapshot, timestamp,
  source, consent-copy version, and optional authenticated actor.
- THE manager consent record SHALL include enabled state, normalized phone snapshot, timestamp,
  consent-copy version, and authenticated actor.
- IF the current phone does not equal the consent phone snapshot, THEN THE data model SHALL treat
  WhatsApp consent as unavailable.
- WHEN a terminal WhatsApp failure requests fallback, THE database SHALL atomically create or
  return the single SMS attempt for that logical notification.
- IF WhatsApp is delivered or read, THEN THE database SHALL refuse an SMS fallback claim.
- IF an SMS fallback already exists, THEN THE database SHALL return it without creating another.
- IF the caller's restaurant does not own the notification, THEN THE database SHALL refuse the
  claim without exposing another tenant's record.

## 6. Verification Criteria and Task Breakdown

Verification must prove migration replay, consent/phone coupling, unique logical identity,
exactly-once fallback under repeated claims, refusal after delivered/read WhatsApp, and tenant
isolation against a real staging database. Implement in vertical order: consent columns; logical
notification table; attempt table; atomic fallback function; RLS/grants; real-database tests;
generated types; staging migration and drift proof.
