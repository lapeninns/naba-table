---
spec_id: MS-data-whatsapp-review-ledger
status: active
risk_class: migrations
owner: codex
last_reviewed: 2026-07-12
allowed_blast_radius:
  - micro-specs/04-data/**
  - micro-specs/evidence/MS-data-whatsapp-review-ledger.json
  - tasks/whatsapp-review-production-release-20260712-1921/**
  - CONTINUITY.md
  - supabase/migrations/**
  - supabase/tests/**
  - server/notifications/mobile.ts
  - server/notifications/whatsapp-status.ts
  - types/supabase.ts
  - tests/micro-specs/mobile-notification-ledger.test.ts
  - tests/server/notifications/mobile-router.test.ts
  - tests/server/twilio-whatsapp-status-webhook-route.test.ts
implementation_surfaces:
  - supabase/migrations/**
  - supabase/tests/**
  - server/notifications/mobile.ts
  - server/notifications/whatsapp-status.ts
  - types/supabase.ts
  - tests/micro-specs/mobile-notification-ledger.test.ts
  - tests/server/notifications/mobile-router.test.ts
  - tests/server/twilio-whatsapp-status-webhook-route.test.ts
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
  - pnpm validate:env
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - Staging migration apply and drift evidence for review notification invariants.
approved_exceptions: []
---

# MS-data-whatsapp-review-ledger — WhatsApp review ledger without SMS fallback

## 1. Exact Goal and User-Visible Outcomes

Each eligible completed booking can create at most one durable WhatsApp review notification and
one WhatsApp attempt. Review failures remain observable but never create or send an SMS fallback,
including failures reported after provider acceptance.

## 2. Blast Radius

In scope are an idempotent staging-first migration, SQL invariant tests, the mobile notification
router/status callback behavior, and focused tests in the declared paths. Out of scope are review
scheduling, consent UI, link creation, templates, email intents, lifecycle-event fallback rules,
and production migration execution.
The task packet, continuity ledger, and this spec's evidence ledger are process-only radius entries.

## 3. Strict Constraints and Assumptions

- The existing mobile notification ledger remains tenant-attributable, service-role-only, and
  monotonic. Real database tests must prove uniqueness and fallback refusal.
- `booking_review_request` is a distinct logical notification type. One booking may have at most
  one such logical notification and one WhatsApp attempt for a recipient snapshot.
- Existing lifecycle events retain exactly-once SMS fallback. Review requests never have fallback.
- Migration SQL is idempotent and must be applied to staging before any production rollout.

## 4. Decisions Already Made

- Review delivery reuses the channel-neutral ledger and Twilio status callback.
- Invalid/ineligible review input, pre-accept send failure, terminal callback failure, stale-attempt
  reconciliation, duplicate delivery, and out-of-order delivery all have a no-SMS outcome.
- Review attempt failures are recorded rather than retried through SMS.
- Email review delivery keeps its own intent and delivery history.

## 5. Behavioral Requirements (EARS)

- WHEN an eligible review is claimed, THE database SHALL create or return one logical
  `booking_review_request` notification for that booking and recipient snapshot.
- WHEN its WhatsApp attempt is claimed, THE database SHALL permit at most one WhatsApp attempt and
  SHALL NOT permit an SMS attempt for that review notification.
- IF a review is invalid or ineligible, THEN THE router SHALL create no SMS attempt and send no SMS.
- IF the WhatsApp review send fails before provider acceptance, THEN THE router SHALL record failure
  and SHALL create no SMS attempt and send no SMS.
- WHEN a review callback reports failed or undelivered, THE callback SHALL record the monotonic
  terminal state and SHALL create no SMS attempt and send no SMS.
- WHEN review reconciliation observes any terminal failure, THE reconciler SHALL preserve the
  failed attempt and SHALL create no SMS attempt and send no SMS.
- IF callbacks or claims are duplicated or out of order, THEN THE ledger SHALL preserve one-shot
  delivery and monotonic status without another WhatsApp or SMS attempt.

## 6. Verification Criteria and Task Breakdown

- Prove idempotent staging migration apply, drift check, uniqueness, tenant boundary, and explicit
  database refusal of review SMS attempts against a real database.
- Prove router, callback, and reconciliation no-SMS paths with focused behavioral tests.
- Prove lifecycle confirmation/update/cancellation fallback behavior is unchanged.
- Implement as Red → Green → Refactor slices for migration, router, callback, and reconciliation.
- Record fresh gates with `governance:run-gates --spec MS-data-whatsapp-review-ledger --record`.
