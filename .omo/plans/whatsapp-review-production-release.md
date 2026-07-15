# whatsapp-review-production-release - Work Plan

## TL;DR (For humans)

<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** A production WhatsApp system with four booking-lifecycle templates plus a fifth post-visit review template containing a native **Leave a review** button. After approval and deployment, one controlled five-message sequence will run at one-minute intervals to the authorized test number.

**Why this approach:** The review button uses Nabatable's fixed redirect domain so every venue can safely reach its own validated Google review page, while consent-v2 and ledger idempotency prevent historic-consent expansion, duplicate messages, and review SMS fallback.

**What it will NOT do:** It will not add WhatsApp reminders, review SMS, campaigns, or two-way chat. It will not deploy pending templates, reinterpret old consent, post a Google review during QA, or include unrelated dirty work.

**Effort:** Large
**Risk:** High - consent, remote database, provider approval, background jobs, Cloudflare redirects, production environment, and live messaging all cross one release boundary.
**Decisions to sanity-check:** One WhatsApp checkbox with consent-v2; old consent stays lifecycle-only; review email remains; review WhatsApp is one-shot and has no SMS fallback; venue review preference remains the master review-outreach switch.

Your next move: start work now, or request the optional dual high-accuracy plan review. Full execution detail follows below.

---

> TL;DR (machine): Large/high-risk governed release across consent-v2, review redirect, ledger/router/callback, queue dispatch, five approved provider templates, staged production deployment, and one five-message T+0/60/120/180/240 smoke.

## Scope

### Must have

- One explicit WhatsApp consent version covering four lifecycle messages plus one post-visit review request.
- Native `Leave a review` button using a fixed Nabatable redirect to the venue's validated Google review URL.
- Review email preserved; review WhatsApp idempotent and never falls back to SMS.
- WhatsApp review scheduling remains independent of email address/suppression while respecting the existing venue review-outreach preference.
- All five provider templates approved and exact Content SIDs/sender configured before production traffic.
- Staging-first database/Worker/app proof, rollback snapshot, production deploy, and one five-message minute-spaced handset proof.

### Must NOT have (guardrails, anti-slop, scope boundaries)

- Do not broaden historical v1 consent, add reminders/review SMS, accept arbitrary redirect hosts, deploy pending templates, or include unrelated `Goal/` work.
- Do not automatically retry a failed review WhatsApp, post a Google review during QA, or deploy directly from dirty `main`.

## Verification strategy

> Zero human intervention - all verification is agent-executed.

- Test decision: TDD with Vitest for app/Worker behavior, real Supabase SQL for ledger constraints, provider readback, Worker smoke, production build, and live WhatsApp/button evidence.
- Evidence: <attemptDir>/task-<N>-whatsapp-review-production-release.<ext> (attemptDir = currentAttemptDir from 'omo ulw-loop status --json', .omo/evidence/ulw/<session>/<goalId>/a<attempt>; outside ulw-loop use .omo/evidence/)

## Execution strategy

### Parallel execution waves

> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

- Wave 1: governance/spec activation, consent-v2, review redirect, ledger/policy tests.
- Wave 2: review dispatch, provider contract/template, integrated verification.
- Wave 3: staging deployment, provider approval gate, production release.
- Wave 4: minute-spaced live event sequence and final audits.

### Dependency matrix

| Todo | Depends on | Blocks     | Can parallelize with |
| ---- | ---------- | ---------- | -------------------- |
| 1    | none       | 2-8        | none                 |
| 2    | 1          | 5,7        | 3,4                  |
| 3    | 1          | 5,7        | 2,4                  |
| 4    | 1          | 5,7        | 2,3                  |
| 5    | 2,3,4      | 7,8        | 6                    |
| 6    | 1          | 7,8        | 5                    |
| 7    | 2-6        | 8          | none                 |
| 8    | 7          | final wave | none                 |

## Todos

> Implementation + Test = ONE todo. Never separate.

<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [x] 1. Author and activate seam-specific Micro-Specs before implementation
     What to do / Must NOT do: Create small active specs for consent-v2, review redirect, and review dispatch/provider release using `pnpm governance:new-spec` and `pnpm governance:advance`; include exact task/evidence/CONTINUITY paths and risk floors. Do not hand-flip lifecycle status or hide the dirty `Goal/` paths in an exception.
     Parallelization: Wave 1 | Blocked by: none | Blocks: 2-8
     References (executor has NO interview context - be exhaustive): `Instructions_MicroSpecsCreation.md`; `micro-specs/README.md`; `micro-specs/03-guest/01-whatsapp-consent.md`; `micro-specs/05-integrations/01-whatsapp-dispatch-fallback.md`; `.omo/drafts/whatsapp-review-production-release.md`.
     Acceptance criteria (agent-executable): every new spec is `active`; `pnpm guard:micro-specs` exits 0; each implementation surface is within its own radius; requirements explicitly cover v1 exclusion, no review SMS, fixed redirect, idempotency, provider approval and production gates.
     QA scenarios (name the exact tool + invocation): happy: governance activation succeeds and recorded specs validate; failure: fixture/spec check proves out-of-radius and hand-flipped status are rejected. Evidence `.omo/evidence/task-1-whatsapp-review-production-release.txt`.
     Commit: Y | `docs(governance): activate WhatsApp review release specs`

- [x] 2. Implement explicit consent-v2 under RED-GREEN-REFACTOR
     What to do / Must NOT do: Change the single guest/ops WhatsApp checkbox copy and persisted version to explicitly cover booking lifecycle messages plus one post-visit review request. Add a predicate that makes review eligible only for the exact current phone and consent-v2. Do not backfill or reinterpret `booking-transactional-v1`.
     Parallelization: Wave 1 | Blocked by: 1 | Blocks: 5,7
     References (executor has NO interview context - be exhaustive): `server/booking/whatsapp-consent.ts:7-72`; `reserve/features/reservations/wizard/ui/steps/DetailsStep.tsx:268-280`; `reserve/features/reservations/wizard/ui/steps/ReviewStep.tsx`; `tests/server/booking-whatsapp-consent.test.ts`; `tests/reserve/**`.
     Acceptance criteria (agent-executable): RED proves v1 is ineligible for review and new copy/version absent; GREEN proves guest and ops copy, persisted v2, phone-change invalidation, review summary and PII-safe behavior; existing four lifecycle events remain eligible under v1.
     QA scenarios (name the exact tool + invocation): happy: Vitest plus shipped Reserve Playwright shows new copy and v2 opt-in; failure: v1 fixture and changed phone cannot dispatch review. Evidence `.omo/evidence/task-2-whatsapp-review-production-release.txt` and `.png`.
     Commit: Y | `feat(consent): cover one WhatsApp review request`

- [x] 3. Add a production-safe review redirect purpose to the Cloudflare short-link service
     What to do / Must NOT do: Extend the existing opaque-token service with `review_request` purpose/source, HTTPS-only exact Google review host/path validation, a review-appropriate TTL, and existing D1/KV semantics. Update Worker allowlist/config and app short-link client. Do not accept arbitrary Google/Search URLs, query destinations outside the write-review form, or expose destination data in logs.
     Parallelization: Wave 1 | Blocked by: 1 | Blocks: 5,7
     References (executor has NO interview context - be exhaustive): `cloudflare/booking-short-links/src/contracts.ts:1-41`; `cloudflare/booking-short-links/src/core.ts:63-130`; `cloudflare/booking-short-links/src/index.ts:61-127`; `cloudflare/booking-short-links/src/storage.ts`; `server/bookings/short-link.ts`; `server/emails/bookings.ts:874-904`; `tests/cloudflare/booking-short-links.test.ts`; `tests/cloudflare/booking-short-links-storage.test.ts`.
     Acceptance criteria (agent-executable): RED rejects missing review purpose behavior; GREEN creates/reuses/rejects/expires review links, only redirects valid allowlisted Google review URLs, and preserves booking-management behavior; Worker tests and smoke pass.
     QA scenarios (name the exact tool + invocation): happy: deployed staging Worker creates a review link and browser follows it to the expected Google write-review origin; failure: evil host, HTTP, wrong Google path, expired/revoked token and cross-purpose reuse are rejected. Evidence `.omo/evidence/task-3-whatsapp-review-production-release.txt` and `.png`.
     Commit: Y | `feat(short-links): add secure review redirects`

- [x] 4. Expand the mobile ledger and router for idempotent WhatsApp-only review delivery
     What to do / Must NOT do: Add `review_request` to the notification type constraint through a new idempotent migration and TypeScript union. Add an explicit fallback policy so review can skip with no attempt when ineligible and record a one-shot failure without claiming SMS. Update signed status-callback and any reconciliation path to inspect notification type and suppress review fallback. Preserve current SMS fallback for all four lifecycle events. This slice ends with local TypeScript/SQL proof and a pending idempotent migration; binding staging apply/readback is owned by task 7 so Wave 1 does not mutate a remote database before the release gate.
     Parallelization: Wave 1 | Blocked by: 1 | Blocks: 5,7
     References (executor has NO interview context - be exhaustive): `supabase/migrations/20260711143000_whatsapp_first_mobile_notifications.sql:68-119`; `server/notifications/mobile.ts:8-60,134-209`; `server/notifications/whatsapp-status.ts:45-123`; `server/observability/delivery-reconciler.ts`; `supabase/tests/**`; `tests/server/notifications/mobile-router.test.ts`; `tests/server/twilio-whatsapp-status-webhook-route.test.ts`; `types/supabase.ts:2074-2115`.
     Acceptance criteria (agent-executable): RED shows review rejected by type/policy and terminal callback would claim SMS; GREEN proves one one-shot WhatsApp attempt under retries, no SMS attempt for invalid phone/ineligible/pre-accept failure/terminal callback/reconciliation, unchanged lifecycle fallback, tenant denial and transactional migration replay. The new migration remains pending until task 7's staging-first gate.
     QA scenarios (name the exact tool + invocation): happy: transactional SQL plus router/callback tests record one review WhatsApp attempt; failure: duplicate job/callback, failed provider, invalid phone and missing consent never create SMS or an automatic second WhatsApp. Evidence `.omo/evidence/task-4-whatsapp-review-ledger.md`.
     Commit: Y | `feat(notifications): add WhatsApp-only review attempts`

- [x] 4A. Add a truthful durable mobile review-intent state machine
      What to do / Must NOT do: Extend the governed mobile notification ledger with scheduled, atomic due-claim and terminal intent state so post-visit review WhatsApp can be delayed and retried before a provider attempt without borrowing `email_dispatch_intents`. Add a service-role-only, tenant-safe claim RPC and a dedicated drain. Scheduling upserts one pending review intent at the computed review time; current booking status, v2 consent, normalized phone, venue preference and review destination are revalidated at drain time. Infrastructure failure before an attempt may retry; after any provider attempt the review remains one-shot. Never mark an email intent from WhatsApp work, let a WhatsApp failure block email, create review SMS, or expose cross-tenant claims. Amend/advance the active data-ledger and delivery Micro-Spec radii before production code. Staging apply remains task 7.
      Parallelization: Wave 2 | Blocked by: 2,3,4 | Blocks: 5,7
      References (executor has NO interview context - be exhaustive): `server/notifications/mobile.ts`; `server/notifications/whatsapp-status.ts`; `server/jobs/booking-side-effects.ts`; `server/queue/email-processing.ts`; `src/app/api/cron/process-emails/route.ts`; `supabase/migrations/20260712204500_add_whatsapp_review_notification_ledger.sql`; existing queue/claim RPC migrations and SQL tests.
      Acceptance criteria (agent-executable): RED proves email-intent coupling, missing delayed durable intent, cross-channel failure propagation and non-atomic claim; GREEN proves one scheduled intent, atomic due claim, tenant isolation, independently truthful email/mobile stats, pre-attempt retryability, post-attempt one-shot finality, and zero review SMS. Migration replay and SQL transactional proof pass locally; staging proof is task 7.
      QA scenarios (name the exact tool + invocation): happy: scheduling creates independent email and mobile intents when both are eligible and each drain succeeds independently; failure: one channel throws, stale/ineligible review, concurrent claims, enqueue failure, retry and provider rejection preserve the other channel and produce no duplicate/SMS. Evidence `.omo/evidence/task-4a-mobile-review-intents.md`.
      Commit: Y | `feat(notifications): add durable review intent drain`

- [x] 5. Dispatch eligible review WhatsApp from the durable review job
     What to do / Must NOT do: Preserve the existing venue review-outreach preference, but schedule/process eligible WhatsApp independently of valid email and global email suppression. Dispatch email when email-eligible and independently attempt review WhatsApp using consent-v2, venue Google review URL, secure review short link, logical-key dedupe and the review template. Keep channel results honest if either fails; never block checkout, duplicate queue retries, automatically retry a failed review WhatsApp, or add SMS.
     Parallelization: Wave 2 | Blocked by: 2,3,4A | Blocks: 7,8
     References (executor has NO interview context - be exhaustive): `server/jobs/booking-side-effects.ts:430-500`; `server/queue/email-processing.ts:68-132`; `server/emails/bookings.ts:874-904,1188-1189`; `server/notifications/mobile.ts`; `server/sms/bookings.ts`; `tests/server/email-processing-security.test.ts`; `tests/server/jobs/booking-side-effects.test.ts`.
     Acceptance criteria (agent-executable): RED proves review scheduling/processing is email-coupled; GREEN proves completed/v2/phone-matched/URL-present booking sends WhatsApp even without valid email, email sends when independently eligible, venue-disabled review sends neither, and v1/no URL/not completed/duplicate/provider failure sends no SMS or duplicate.
     QA scenarios (name the exact tool + invocation): happy: guarded local queue processing emits email plus one WhatsApp, and phone-only v2 emits one WhatsApp; failure: venue preference false, tenant mismatch, stale event, v1 consent, provider rejection and queue retry produce no review SMS/duplicate. Evidence `.omo/evidence/task-5-whatsapp-review-production-release.txt`.
     Commit: Y | `feat(reviews): send consented WhatsApp review request`

- [ ] 6. Create and approve the native review template and complete the five-template environment contract
     What to do / Must NOT do: Add review Content SID to env schema/example/runtime and create `twilio/call-to-action` copy with a native `Leave a review` button at `https://go.nabatable.com/{{suffix}}`. Poll exact approval readback for all five selected templates. Do not configure pending/rejected SIDs or templates whose body ends in a variable.
     Parallelization: Wave 2 | Blocked by: 1 | Blocks: 7,8
     References (executor has NO interview context - be exhaustive): `config/env.schema.ts:140-152`; `lib/env.ts:185-199`; `.env.example:20-40`; `lib/twilio/sms.ts`; `tests/lib/twilio-sms.test.ts`; `tasks/whatsapp-conversational-templates-20260712-1753/verification.md`; Twilio `twilio/call-to-action` primary documentation.
     Acceptance criteria (agent-executable): review template exact body/action/variables and provider-assigned category recorded; all five chosen SIDs return `approved` with empty rejection reason; material recategorization/rejection stops release; env parsing requires sender plus five template SIDs for production WhatsApp readiness; pending/rejected fixture is refused by release preflight.
     QA scenarios (name the exact tool + invocation): happy: provider readback matches five expected templates and local request construction; failure: blank sender/SID, wrong action origin, ending variable, pending or rejected template blocks activation. Evidence `.omo/evidence/task-6-whatsapp-review-production-release.json`.
     Commit: Y | `feat(config): require five WhatsApp templates`

- [x] 6A. Restore the governed remote-only database safe-run prerequisite
      What to do / Must NOT do: Author and activate the smallest seam-specific Micro-Spec for the missing binding `scripts/db/safe-run.ts`, then implement it test-first. The wrapper must validate the declared environment contract, make the target project/environment explicit, refuse production unless the repository's intentional production confirmation contract is satisfied, preserve argument boundaries, redact secrets, and provide deterministic dry-run/help behavior. Reconcile every existing `db:*` package script and `docs/sdlc` reference with the implemented interface. Do not run a migration, invent credentials, weaken staging-first, or place database logic in the shell wrapper.
      Parallelization: Wave 2 | Blocked by: 1 | Blocks: 7
      References (executor has NO interview context - be exhaustive): `AGENTS.md` database commands and remote-only rule; `micro-specs/README.md`; `micro-specs/GLOBAL_CONTEXT.md` sections 4 and 6; `package.json` `db:*` scripts; `scripts/db/**`; `docs/sdlc/verification.md`; `config/env.schema.ts`; `pnpm validate:env`.
      Acceptance criteria (agent-executable): active Micro-Spec and RED/GREEN tests cover missing env, staging target, explicit production refusal/confirmation, dry-run, argument preservation, nonzero child exit propagation and secret redaction; all `db:*` scripts resolve to existing paths; focused tests, typecheck, lint, governance and no-excuse audit pass; no remote command is executed during the slice.
      QA scenarios (name the exact tool + invocation): happy: mock-process staging dry-run prints the redacted command and exits zero; failure: missing vars, unknown target, production without explicit confirmation and child failure all stop deterministically without remote mutation. Evidence `.omo/evidence/task-6a-db-safe-run.md`.
      Commit: Y | `fix(db): restore governed safe-run wrapper`

- [ ] 7A. Apply and prove the release candidate in staging, then open the gated PR
      What to do / Must NOT do: From the isolated `codex/whatsapp-review-production` branch, run the restored safe environment contract; apply/replay/read back the expand-only migration on the linked staging project; execute transactional SQL and drift proof; deploy/smoke the review-purpose Worker in staging; run the declared app/security/worker/notification gates; capture redacted rollback inputs; push the branch and open the PR with CI required. Provider templates may remain pending during this staging-only phase, but production sender/SIDs and production traffic must remain untouched. Exclude `Goal/` and unrelated main-checkout work.
      Parallelization: Wave 3 | Blocked by: 2-5,6A | Blocks: 7
      References (executor has NO interview context - be exhaustive): `AGENTS.md` database/verification commands; `scripts/db/safe-run.ts`; `scripts/cloudflare/deploy-booking-short-links.sh`; `scripts/cloudflare/smoke-booking-short-links.ts`; `.github/workflows/test-suite.yml`; task 4A/5/6A evidence.
      Acceptance criteria (agent-executable): `validate:env` passes for staging; migration apply/replay/list/drift and SQL proof pass with linked staging readback; Worker staging deploy/readback and real HTTP redirect smoke pass; bounded/full declared gates, typecheck, lint, build, security and worker QA pass; branch contains only governed release files; PR is open and CI is green or its exact pending/failure state is reported; production env/deployment/provider traffic are unchanged.
      QA scenarios (name the exact tool + invocation): happy: staging scheduling/claim/finalization SQL proof and Worker review redirect smoke pass; failure: wrong target, migration drift, cross-tenant claim, review SMS, unsafe review URL or Worker smoke failure aborts before production. Evidence `.omo/evidence/task-7a-whatsapp-review-staging.txt`.
      Commit: Y | `chore(release): stage WhatsApp review delivery`

- [ ] 7. Release the Worker, migration, app and production configuration atomically
     What to do / Must NOT do: Require task 7A staging/PR proof and all five provider approvals. Capture current production env/deployment/Worker versions for rollback; merge only with green CI; apply the production expand migration through the safe wrapper, deploy the production Worker, set the exact registered sender and approved five SIDs, deploy Vercel production, and verify production SHA/health/config without exposing secrets. Exclude `Goal/` and unrelated work. Rollback disables/unsets review first, restores prior four SIDs/deployment and Worker version, and leaves the expand-only migration in place.
     Parallelization: Wave 3 | Blocked by: 6,7A | Blocks: 8
     References (executor has NO interview context - be exhaustive): `AGENTS.md` database/verification commands; `scripts/db/safe-run.ts`; `scripts/cloudflare/deploy-booking-short-links.sh`; `scripts/cloudflare/smoke-booking-short-links.ts`; `vercel.json`; `.github/workflows/test-suite.yml`; `tasks/whatsapp-conversational-templates-20260712-1753/verification.md`.
     Acceptance criteria (agent-executable): task 7A staging and PR/CI proof is green; all five SIDs are approved with the first approved category lock recorded; merged production SHA matches Vercel readback; production migration and Worker/app versions read back; rollback commands/artifacts are captured and review-disable rollback rehearsed; no unrelated diff is committed.
     QA scenarios (name the exact tool + invocation): happy: production health, redirect and config preflight pass with secrets redacted; failure: any non-approved template, env blank, migration drift, Worker smoke failure or Vercel failure aborts before traffic activation and restores prior config/version. Evidence `.omo/evidence/task-7-whatsapp-review-production-release.txt`.
     Commit: Y | `feat(whatsapp): release production review messaging`

- [ ] 8. Run one five-event production sequence at one-minute intervals and verify every destination
     What to do / Must NOT do: Normalize the user-authorized number to `+447467586751`. Send confirmation, update, guest cancellation, restaurant cancellation, and review exactly once each, with 60 seconds between starts. Use real production templates, real button redirects, and terminal provider readback. Do not loop, send all five every minute, expose the phone in artifacts, or substitute placeholder links.
     Parallelization: Wave 4 | Blocked by: 7 | Blocks: final wave
     References (executor has NO interview context - be exhaustive): `tasks/whatsapp-conversational-templates-20260712-1753/verification.md`; selected provider Content SIDs from task 6; production sender/config readback from task 7; `lib/twilio/sms.ts` message fetch helpers.
     Acceptance criteria (agent-executable): five send timestamps are at least 60 seconds apart in required order; all five reach delivered/read with no provider error; confirmation/update/review buttons open expected production destinations; cancellation copy/contact is correct; no SMS fallback or sixth message exists.
     QA scenarios (name the exact tool + invocation): happy: provider status timeline plus browser button navigation and message count prove the full sequence; failure: terminal failure, wrong link, duplicate, spacing under 60 seconds or SMS attempt fails the gate and triggers rollback/no further sends. Evidence `.omo/evidence/task-8-whatsapp-review-production-release.json` and `.png`.

## Final verification wave

> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.

- [ ] F1. Plan compliance audit
- [ ] F2. Code quality review
- [ ] F3. Real manual QA
- [ ] F4. Scope fidelity

## Commit strategy

- Keep governance specs/evidence, consent, redirect, ledger/router, review dispatch/config, and release records in atomic commits matching todos.
- Stage explicit paths/hunks only. Never stage `.omo/`, unrelated `Goal/`, or user-owned dirty changes unless the repository contract explicitly requires a durable task artifact in the feature commit.
- Push only after all pre-production gates pass; use normal fast-forward push, never force-push `main`.

## Success criteria

- Five-event matrix is observable: four SMS-parity lifecycle events plus one review WhatsApp event; reminders absent.
- Review has a native working `Leave a review` button, email coexistence, consent-v2 eligibility, durable dedupe and no SMS fallback.
- All five templates are Meta-approved and production sender/SIDs are nonblank and read back correctly.
- Staging and production migration/Worker/app deployments pass their smoke and rollback gates.
- Exactly five live WhatsApp messages are sent once, one minute apart, and all are delivered/read with correct button destinations.
- Git history contains only scoped commits; unrelated work remains untouched.
