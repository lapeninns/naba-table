---
slug: whatsapp-review-production-release
status: plan-complete
intent: clear
pending-action: write .omo/plans/whatsapp-review-production-release.md
approach: consent-v2 plus fixed-origin review redirects, idempotent no-SMS-fallback review dispatch, provider approval gates, staged deployment, and one five-message minute-spaced production proof
---

# Draft: whatsapp-review-production-release

## Components (topology ledger)

<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->

consent-v2 | one checkbox explicitly covers lifecycle messages plus one review request; old v1 consent is not broadened | active | server/booking/whatsapp-consent.ts:7-60
review-redirect | fixed-origin button resolves only an allowlisted stored venue review URL | active | cloudflare/booking-short-links/src/core.ts:72-109
review-dispatch | completed-booking review job sends email plus idempotent eligible WhatsApp with no SMS review fallback | active | server/queue/email-processing.ts:68-132
provider-contract | five approved templates map to strict variables and environment keys | active | lib/env.ts:185-199
production-release | worker, migration, Vercel config, app deploy, rollback and minute-spaced proof are observed live | active | package.json:139-141

## Open assumptions (announced defaults)

<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->

consent | booking-plus-review-v2 applies only to new or reconfirmed opt-ins | avoids silently broadening v1; reversible copy/version change
review fallback | retain existing review email; never create SMS review | matches locked event matrix; reversible routing policy
test cadence | send exactly five messages once, one per minute, in confirmation/update/guest-cancel/restaurant-cancel/review order | safest reading of user request; reversible test-only action
review link TTL | use a durable review-link expiry appropriate to post-visit delivery and provider retries, not the short booking-recovery TTL | review links must remain useful; reversible TTL policy

## Findings (cited - path:lines)

- Current consent is `booking-transactional-v1` and UI says booking messages only (`server/booking/whatsapp-consent.ts:7-60`, `reserve/features/reservations/wizard/ui/steps/DetailsStep.tsx:268-276`).
- Review eligibility already requires `completed` and excludes events older than 30 days (`server/queue/email-processing.ts:68-91`).
- Current mobile router always claims SMS for ineligible/failing WhatsApp, so review needs an explicit no-fallback policy (`server/notifications/mobile.ts:134-209`).
- Short links only allow `booking_manage` and Nabatable hosts; review links require a separate purpose/source and narrow Google review host policy (`cloudflare/booking-short-links/src/contracts.ts:3-35`, `cloudflare/booking-short-links/src/core.ts:72-109`).
- Four lifecycle templates remain Meta `pending`; production sender and Content SID values are blank. Production activation is therefore blocked until provider approval and configuration.
- Worktree is dirty on `main`; unrelated untracked `Goal/` content must remain outside commits and deployment diffs.

## Decisions (with rationale)

- Use a single explicit `booking-plus-review-v2` WhatsApp opt-in. Existing v1 bookings remain lifecycle-only until reconfirmed.
- Preserve review email and add WhatsApp as the fifth event; never add review SMS.
- Use the current opaque D1-backed `go.nabatable.com/m/<token>` redirect architecture with a distinct review purpose/source, exact HTTPS Google review host allowlist, and no arbitrary URL actions.
- Record review WhatsApp in the mobile ledger under a new `review_request` notification type and logical key so queue retries cannot duplicate it.
- Do not set pending Content SIDs in production. Configure all five only after every selected Meta template is approved and exact provider readback matches the plan.
- Run TDD and deploy staging-first. Production release requires worker smoke, DB invariant proof, app build/QA, rollback snapshot, and real handset/button evidence.
- Review WhatsApp scheduling is independent of recipient email validity and global email
  suppression, but the existing venue `sendReviewRequest` preference remains the review-outreach
  master switch until a channel-neutral preference is separately designed.
- Review WhatsApp is one-shot: a provider failure is recorded and never automatically retried or
  converted to SMS; duplicate jobs/callbacks remain deduped. Manual retry UI is out of scope.
- Provider category is not presumed. The release accepts Meta's final approved category and stops
  if the content is rejected or materially recategorized from the intended non-promotional copy.
- Isolate release work on `codex/whatsapp-review-production`; use scoped commits/PR/CI and verify
  the production deployment SHA after merge rather than deploying the mixed dirty `main` tree.

## Scope IN

- Consent copy/version and existing Reserve/ops WhatsApp checkbox behavior.
- Review redirect contracts, Worker deployment and live redirect smoke.
- Mobile ledger constraint expansion, no-SMS fallback policy, review dispatch and queue idempotency.
- Review template creation/approval and five-template production environment mapping.
- Git commit/push, Vercel production deploy, migration application under safe-run, rollback evidence.
- One five-event WhatsApp test sequence at one-minute intervals to the user-authorized normalized recipient.

## Scope OUT (Must NOT have)

- No reminders on WhatsApp.
- No review SMS, campaigns, two-way inbox, chatbot, or per-venue WhatsApp sender.
- No reuse of v1 consent for review and no retroactive consent backfill.
- No deployment with pending/rejected templates, blank sender/SIDs, placeholder links, or unrelated `Goal/` changes.
- No repeated loop beyond one five-message sequence.
- No posting a Google review during QA; button navigation stops at the write-review page.

## Open questions

- None. The user's latest request is treated as approval of the recommended consent-v2 model and one minute-spaced five-event production proof.

## Approval gate

status: approved

## Metis review receipt

- Reviewer: `/root/wa_release_metis`
- Result: gaps integrated.
- Material corrections: added separate active Micro-Spec seams; callback/reconciler no-SMS rules;
  email-independent scheduling under the existing venue review preference; one-shot review failure
  semantics; provider category/readiness gate; dirty-main branch/PR isolation; staging/production
  migration and deployment order; rollback; and controlled T+0/60/120/180/240 template smoke
  semantics rather than pretending mutually terminal events form one booking lifecycle.
  <!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
  <!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
