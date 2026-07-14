---
spec_id: MS-integrations-guest-whatsapp-template-refresh
status: active
risk_class: webhooks
owner: amankumarshrestha
last_reviewed: 2026-07-14
allowed_blast_radius:
  - micro-specs/integrations/guest-whatsapp-template-refresh.md
  - micro-specs/evidence/MS-integrations-guest-whatsapp-template-refresh.json
  - scripts/whatsapp-review-production-release.ts
  - tests/scripts/whatsapp-review-production-release.test.ts
  - .omo/evidence/guest-whatsapp-template-refresh.json
  - tasks/guest-whatsapp-template-refresh-20260714-1728/**
  - CONTINUITY.md
implementation_surfaces:
  - scripts/whatsapp-review-production-release.ts
  - tests/scripts/whatsapp-review-production-release.test.ts
  - .omo/evidence/guest-whatsapp-template-refresh.json
  - tasks/guest-whatsapp-template-refresh-20260714-1728/**
  - CONTINUITY.md
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - docs/sdlc/verification.md
related_tests:
  - tests/scripts/whatsapp-review-production-release.test.ts
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
  - Provider creation, approval, production cutover, rollback, and controlled delivery evidence with PII redacted.
approved_exceptions: []
---

# MS-integrations-guest-whatsapp-template-refresh — WhatsApp template refresh

## 1. Exact Goal and User-Visible Outcomes

Guests receive warm, scannable WhatsApp copy for booking confirmation, booking update,
guest-requested cancellation, venue cancellation, and post-visit review. Existing native actions,
variable meanings, event eligibility, consent, SMS fallback, and review-delivery behavior remain
unchanged. Restaurant managers receive a clearer daily-summary wrapper without changing the
existing summary payload. Production moves to the six new templates only after all are approved
and a reversible cutover is proven.

## 2. Blast Radius

In scope are the exact six-template provider request contract, fail-closed approval and category
checks, versioned Twilio template creation, production Content SID cutover, rollback evidence, and
controlled delivery proof. Out of scope are reminder events, SMS/email copy, consent, routing,
ledger/database behavior, webhook behavior, UI, and arbitrary provider account changes. The task
packet, continuity ledger, and evidence files are process-only entries.

## 3. Strict Constraints and Assumptions

- The currently approved six SIDs remain recorded and usable as the rollback set until the new set
  is approved, configured, deployed, and verified.
- Confirmation and update retain the fixed `https://go.nabatable.com/{{5}}` booking action and full
  fallback URL in `{{4}}`; review retains `https://go.nabatable.com/{{2}}`.
- Cancellation `{{4}}` remains the venue contact line. No variable meaning or numbering changes.
- Template bodies may not begin or end with a variable, and every variable used by a body or action
  must have a provider sample.
- The manager summary retains its existing single `{{1}}` operational payload and text content type.
- Production configuration changes as one six-template set; partial activation is forbidden.
- Provider credentials, phone numbers, secure links, and recipient PII are excluded from source,
  logs, and durable evidence.

## 4. Decisions Already Made

- The exact operator-approved bodies are those recorded in the task packet `drafts.md`.
- Confirmation uses `Manage booking`; update uses `Review booking`; review uses `Leave a review`.
- Booking lifecycle templates require provider category `UTILITY`; review requires `MARKETING`.
- The manager daily summary requires provider category `UTILITY`.
- Successors use new versioned names and never edit or delete the approved rollback templates.
- Production cutover occurs only after every successor returns `Approved` with no rejection reason.
- The manager daily-summary successor uses the approved clearer operational wrapper while preserving
  the existing summary variable payload.

## 5. Behavioral Requirements (EARS)

- THE release contract SHALL define the exact approved body, variable samples, type, action label,
  and fixed action URL for each of the five guest templates, plus the exact manager-summary body,
  sample, and text type.
- IF a template body, name, variable sample, action label, action origin, or content type differs
  from the approved contract, THEN THE validator SHALL refuse provider submission.
- IF a body starts or ends with a variable or references an unsampled variable, THEN THE validator
  SHALL refuse provider submission.
- WHEN successor templates are created, THE provider operation SHALL create new versioned content
  records and SHALL NOT edit or delete the approved rollback set.
- WHEN provider state is checked, THE release gate SHALL require all six successor SIDs to be
  approved with the locked category and an empty rejection reason.
- IF any successor is pending, rejected, missing, mismatched, or recategorized, THEN THE release
  SHALL refuse production configuration without partially changing the selected set.
- WHEN all six successors pass the release gate, THE production environment SHALL select their
  exact SIDs while preserving the existing sender.
- IF deployment or controlled proof fails, THEN THE release SHALL restore the six recorded
  rollback SIDs without changing unrelated production configuration.
- WHEN controlled proof is explicitly armed, THE release SHALL send only the five agreed guest
  events and one manager-summary event to the authorised test recipient and SHALL record provider
  delivery/read state and native action destinations without retaining recipient PII.

## 6. Verification Criteria and Task Breakdown

- Prove all six exact request objects and rejection of copy, type, sample, and action drift.
- Prove variable-boundary and missing-sample rejection for text and call-to-action templates.
- Prove readiness accepts only the full approved category-locked six-SID set.
- Record the rollback SIDs before creating provider content or changing production configuration.
- Create and submit the six versioned successors, then capture exact provider readback.
- Cut over production only after approval and verify deployment/environment readback.
- Run controlled delivery/action proof and restore rollback SIDs on any failed release check.
- Prove the repo with `governance:run-gates --spec MS-integrations-guest-whatsapp-template-refresh --record`.
