# Task 4a — Durable mobile review intents

Date: 2026-07-12  
Mode: local implementation and guarded verification only  
Remote database or provider mutation: none

## Outcome

- `mobile_notifications` owns review scheduling and processing state; review work is never placed
  in `email_dispatch_intents`.
- `schedule_mobile_review_notification` preserves one logical review row and never revives a
  terminal intent.
- `claim_due_mobile_review_notifications` atomically claims due work with
  `FOR UPDATE SKIP LOCKED`, rotates an unguessable claim token, reclaims stale work within the
  bounded attempt policy, and terminally fails exhausted stale claims.
- Worker finalization is a compare-and-set over notification id, restaurant id, claimed state, and
  claim token. A stale worker therefore cannot finalize a newer claim.
- Provider-attempt failure and provider-accepted persistence loss remain one-shot outcomes.
  Known attempt id, SID, status, and error are retained as retryable finalization work; the retry
  never invokes the provider again.
- The signed Twilio callback carries the attempt correlation id. The atomic finalizer binds the
  provider SID while preserving a callback status that advanced before the send promise returned.

## TDD evidence

- RED: finalization tests failed until tenant-scoped claim ownership was included in the CAS.
- RED: drain tests required durable provider-result and pre-accept-failure payloads plus
  finalization-only retry paths with zero provider resend.
- RED: a callback could advance to delivered before the send promise returned and then be regressed
  to queued; the monotonic finalizer now returns the authoritative stored status.
- SQL rollback proof rotates ownership across a stale reclaim, rejects the prior token, accepts the
  current token exactly once, and verifies terminal non-revival and non-reclaim.

## Verification boundary

- Focused Vitest coverage exercises scheduling, claiming, finalization ownership, truthful dispatch
  outcomes, and signed callback correlation using local mocks.
- The migration and SQL invariant script are prepared for the staging-first safe-run workflow.
  Applying them to staging is intentionally deferred to the controlled release task.
