# Task 5 — WhatsApp review delivery

Date: 2026-07-12  
Mode: local implementation and guarded mock verification only  
Remote/provider mutation: none

## Outcome

- Completed bookings schedule email and WhatsApp review work independently.
- Eligible WhatsApp review work is stored on the mobile notification ledger, never in
  `email_dispatch_intents`.
- The durable mobile intent has pending, claimed, processed, skipped, and failed states; terminal
  work is not revived, stale claims are reclaimable before the third attempt, and due claiming uses
  `FOR UPDATE SKIP LOCKED`.
- Every claim rotates an ownership token, and finalization compares notification id, tenant,
  claimed state, and token so a stale worker cannot overwrite a newer claim.
- The worker revalidates completed status, tenant, version 2 consent, phone snapshot, venue review
  preference, approved template configuration, and purpose-scoped review link before the one-shot
  provider attempt.
- Review provider outcomes never create SMS fallback. Email remains independently eligible and
  independently reported.
- Provider-attempt failure and provider-accepted persistence loss remain distinct and durable.
  Known provider or failure truth is retained on the intent and retried as database finalization
  only, with no second provider send. A signed callback can bind the SID concurrently, and the
  monotonic finalizer never regresses its status.
- Confirmation and update templates use only canonical `m/<token>` native action suffixes; invalid
  actions fall back to lifecycle SMS.

## TDD evidence

- RED: 8 lifecycle native-action failures before the reviewed fixed-origin behavior was
  transplanted.
- RED: 2 review worker failures before email-independent review evaluation.
- RED: 2 scheduling/ledger failures before the mobile intent state machine replaced the email
  intent misuse.
- RED: 4 dedicated drain failures before due claiming, terminal finalization, retry, and skip paths.
- RED: partial cron failure omitted channel truth before independent channel reporting.
- RED: stale claimed work had no recovery contract before the bounded reclaim rule.
- RED: finalization was not tenant-scoped until the claim ownership test required the complete CAS.
- RED: provider result and pre-accept failure persistence loss were not durable until intent payload
  and finalization-only retry tests were added.
- RED: post-send SID binding could overwrite a faster delivered callback with queued; the atomic
  finalizer now preserves callback truth and reports the affected-row readback status.
- Lifecycle pre-accept failure now retries attempt finalization twice; if both writes fail, one
  atomic RPC marks the WhatsApp attempt failed and claims the SMS fallback before SMS delivery.
  Confirmation, update, guest cancellation, and restaurant cancellation all exercise this path;
  review finalization remains durable and SMS-free.
- The atomic pre-accept fallback rejects null/foreign attempt lookups, scopes the failure update to
  the trusted notification and recipient, and derives the SMS recipient from the locked
  notification. SQL proof covers cross-notification and cross-tenant attempt ids without mutation.

## Verification

- Claim ownership/provider-outcome/lifecycle blocker matrix: 91/91 passed across 7 files.
- Focused review/lifecycle/queue/config matrix: 156/156 passed across 14 files.
- Guarded background workers with `QA_EXTERNAL_MUTATION_MODE=mock`: 125/125 passed across 19 files.
- `pnpm typecheck`: passed.
- Targeted ESLint: passed.
- TypeScript no-excuse audit on new modules/tests: passed.
- `pnpm guard:micro-specs`: passed (32 specs).
- `pnpm governance:check`: passed.
- `pnpm build`: passed twice in fresh sequential processes using a temporary ignored link to the
  existing local staging environment; all 72 static pages completed both times. A separately
  reported dev-route prerender failure did not reproduce. The link and generated `next-env.d.ts`
  churn were removed afterward.
- Transactional SQL rollback proof now covers schedule, exact-once claim, terminal non-revival,
  terminal non-reclaim, tenant attribution, recipient alignment, and explicit review SMS refusal.
  Remote staging execution is deferred to Task 7 under the safe-run contract.

## Known unrelated suite result

The unfiltered `pnpm test` run again reached the pre-existing
`tests/server/capacity/planner-stress.test.ts` 5-second timeout. Its 13 tests pass with the known
larger timeout; this task did not modify capacity code.

## Cleanup

- No provider send, template mutation, deployment, or remote database write occurred.
- No `.env.local` link, `.wrangler` state, dev server, or generated `next-env.d.ts` churn remains.
