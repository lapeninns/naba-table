---
spec_id: MS-data-whatsapp-review-ledger
status: active
risk_class: migrations
owner: codex
last_reviewed: 2026-07-14
allowed_blast_radius:
  - micro-specs/04-data/**
  - micro-specs/evidence/MS-data-whatsapp-review-ledger.json
  - tasks/whatsapp-review-production-release-20260712-1921/**
  - .omo/evidence/task-4-*
  - .omo/evidence/task-4a-mobile-review-intents.md
  - CONTINUITY.md
  - supabase/migrations/**
  - supabase/tests/**
  - server/notifications/mobile.ts
  - server/notifications/whatsapp-status.ts
  - src/app/api/webhook/twilio/whatsapp-status/route.ts
  - types/supabase.ts
  - tests/micro-specs/mobile-notification-ledger.test.ts
  - tests/server/notifications/mobile-router.test.ts
  - tests/server/twilio-whatsapp-status-webhook-route.test.ts
  - tests/server/service-only-rpc-privileges.test.ts
implementation_surfaces:
  - supabase/migrations/**
  - supabase/tests/**
  - server/notifications/mobile.ts
  - server/notifications/whatsapp-status.ts
  - types/supabase.ts
  - tests/micro-specs/mobile-notification-ledger.test.ts
  - tests/server/notifications/mobile-router.test.ts
  - tests/server/twilio-whatsapp-status-webhook-route.test.ts
  - tests/server/service-only-rpc-privileges.test.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/mobile-notification-ledger.test.ts
  - tests/server/service-only-rpc-privileges.test.ts
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

In scope are an idempotent staging-first migration, SQL invariant tests, durable review-intent
state and atomic due claiming on the mobile notification ledger, the mobile notification
router/status callback behavior, and focused tests in the declared paths. Out of scope are review
timing policy, consent UI, link creation, templates, email intents, lifecycle-event fallback
rules, and production migration execution.
The task packet, continuity ledger, and this spec's evidence ledger are process-only radius entries.

## 3. Strict Constraints and Assumptions

- The existing mobile notification ledger remains tenant-attributable, service-role-only, and
  monotonic. Real database tests must prove uniqueness and fallback refusal.
- `booking_review_request` is a distinct logical notification type. One booking may have at most
  one such logical notification and one WhatsApp attempt for a recipient snapshot.
- Existing lifecycle events retain exactly-once SMS fallback. Review requests never have fallback.
- Migration SQL is idempotent and must be applied to staging before any production rollout.
- Historical privilege hardening tolerates service-only menu RPCs already removed by an earlier
  retirement migration while continuing to harden any of those RPCs that still exist.
- The staging database proof uses a booking already satisfying completed-lifecycle invariants and
  never bypasses or reconstructs lifecycle state through a direct status rewrite.

## 4. Decisions Already Made

- Review delivery reuses the channel-neutral ledger and Twilio status callback.
- The logical review notification also carries its scheduled/claimed/final intent state; an atomic
  service-role RPC claims due review work without using the email-intent table.
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
- WHEN a worker claims review work, THE database SHALL issue a fresh ownership token and THE worker
  SHALL finalize only the matching tenant, claimed state, and ownership token.
- IF an older worker attempts to finalize after stale work is reclaimed, THEN THE database SHALL
  reject the stale ownership token without changing the newer claim.
- IF a lifecycle pre-accept fallback supplies an attempt from another notification or tenant, THEN
  THE database SHALL reject it without mutating the foreign attempt or creating an SMS attempt.
- IF provider acceptance succeeds but immediate SID persistence fails, THEN THE signed callback
  correlation SHALL bind the provider SID to the existing attempt and THE intent SHALL retain a
  retryable finalization payload rather than retrying provider delivery.
- IF provider result or pre-accept failure finalization cannot be persisted immediately, THEN THE
  mobile intent SHALL durably retain the attempt id, known SID, status, and error and SHALL retry
  only attempt finalization without another provider send.
- IF a correlated callback advances the attempt before the provider promise returns, THEN THE
  post-send finalizer SHALL bind the known SID while preserving the more advanced callback status
  and SHALL return the authoritative stored status.
- WHEN a review intent is scheduled or replayed, THE database SHALL preserve one logical row and
  SHALL NOT revive a terminal intent.
- WHEN due review intents are claimed concurrently, THE database SHALL return each pending intent
  to at most one worker and SHALL expose retryable infrastructure failure separately from a
  terminal one-shot provider attempt.
- IF a retired service-only menu RPC is absent when historical privilege hardening replays, THEN THE
  migration SHALL skip that exact RPC and SHALL continue to revoke browser-role execution and grant
  service-role execution for every listed RPC that still exists.
- WHEN the staging ledger proof selects its fixture booking, THE proof SHALL require an existing
  completed booking and SHALL leave its lifecycle status and timestamps unchanged.

## 6. Verification Criteria and Task Breakdown

- Prove idempotent staging migration apply, drift check, uniqueness, tenant boundary, terminal
  non-revival, atomic due claiming, and explicit database refusal of review SMS attempts against a
  real database.
- Prove router, callback, and reconciliation no-SMS paths with focused behavioral tests.
- Prove lifecycle confirmation/update/cancellation fallback behavior is unchanged.
- Prove the historical service-only privilege migration guards each retired menu RPC by exact
  signature without weakening restrictions for present functions.
- Prove the staging ledger fixture selects a completed booking and never directly changes booking
  lifecycle status.
- Implement as Red → Green → Refactor slices for migration, router, callback, and reconciliation.
- Record fresh gates with `governance:run-gates --spec MS-data-whatsapp-review-ledger --record`.
