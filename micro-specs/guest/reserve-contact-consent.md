---
spec_id: MS-guest-reserve-contact-consent
status: verified
risk_class: customer-pii
owner: amankumarshrestha
last_reviewed: 2026-07-12
allowed_blast_radius:
  - micro-specs/guest/**
  - reserve/features/reservations/wizard/hooks/useReservationWizard.ts
  - reserve/features/reservations/wizard/hooks/useWizardDraftStorage.ts
  - reserve/features/reservations/wizard/model/reducer.ts
  - reserve/features/reservations/wizard/model/schemas.ts
  - reserve/features/reservations/wizard/model/transformers.ts
  - reserve/features/reservations/wizard/ui/steps/DetailsStep.tsx
  - server/bookings/create-completion.ts
  - server/bookings/create-payloads.ts
  - server/bookings/request-validation.ts
  - tests/reserve/**
  - tests/server/booking-create-completion.test.ts
  - tests/server/booking-create-customer-context.test.ts
  - tests/server/booking-create-payloads.test.ts
  - tests/server/booking-create-request-payload.test.ts
  - tests/server/booking-request-validation.test.ts
implementation_surfaces:
  - micro-specs/guest/reserve-contact-consent.md
  - reserve/features/reservations/wizard/hooks/useReservationWizard.ts
  - reserve/features/reservations/wizard/hooks/useWizardDraftStorage.ts
  - reserve/features/reservations/wizard/model/reducer.ts
  - reserve/features/reservations/wizard/model/schemas.ts
  - reserve/features/reservations/wizard/model/transformers.ts
  - reserve/features/reservations/wizard/ui/steps/DetailsStep.tsx
  - server/bookings/create-completion.ts
  - server/bookings/create-payloads.ts
  - server/bookings/request-validation.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - tasks/customer-booking-wizard-audit-20260712-1004/plan.md
related_tests:
  - tests/reserve/detailsFormSchema.test.ts
  - tests/reserve/buildReservationDraft.test.ts
  - tests/reserve/wizardDraftStorage.test.ts
  - tests/reserve/wizardDraftStoragePii.test.ts
  - tests/reserve/features/reservations/wizard/model/reducer.test.ts
  - tests/reserve/features/reservations/wizard/ui/steps/DetailsStep.test.tsx
  - tests/reserve/timeoutRecovery.test.ts
  - tests/server/booking-create-completion.test.ts
  - tests/server/booking-create-customer-context.test.ts
  - tests/server/booking-create-payloads.test.ts
  - tests/server/booking-create-request-payload.test.ts
  - tests/server/booking-request-validation.test.ts
verification_gates:
  - pnpm governance:check
  - pnpm test --maxWorkers=8
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm reserve:build
  - pnpm guard:no-shadcn:strict
  - pnpm guard:luma:strict
  - pnpm qa:reserve-app:browser
  - pnpm qa:observability-privacy
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions:
  - 'evidence-waiver: verified on the intentionally uncommitted audit task tree; no commit was requested (expires: 2026-07-19)'
---

# MS-guest-reserve-contact-consent — Reserve contact and consent clarity

## 1. Exact Goal and User-Visible Outcomes

Guests can complete the shipped Reserve Details step with either a valid email address or a
valid UK phone number, can understand which fields and choices are required, and must make a
fresh explicit acceptance of the booking terms before continuing. The public booking API
preserves that same contact contract through persistence.

## 2. Blast Radius

Edits are limited to the Reserve Details schema, state/draft handling, reservation payload
transform, Details UI, the existing public booking request/payload completion seam, this spec,
and their listed tests. The shared shadcn primitive layer, ops booking UI and validation,
database schema/RPCs, other wizard steps, contact lookup/recovery endpoints, and notification
policy are out of scope.

## 3. Strict Constraints and Assumptions

- Preserve the existing server-only mutation boundary and atomic booking creation path.
- Store an omitted booking contact using the existing empty-string representation; no migration
  or synthetic guest contact is introduced.
- Do not persist legal acceptance in local draft or remembered-contact storage, and do not infer
  it from authenticated profile data.
- Keep ops-mode behavior unchanged: ops does not require guest legal acceptance and already
  accepts email or phone.
- Use the existing Luma shadcn primitives; touch-target changes are scoped to Details only.
- Keep guest PII out of logs, analytics, test snapshots, and evidence.

## 4. Decisions Already Made

- D1: customer mode accepts a valid email or a valid UK phone; neither contact is individually
  mandatory when the other is valid.
- D2: interactive controls changed by this slice use a minimum 44px target on Details only; no
  shared primitive is changed.
- D3: legal acceptance starts unchecked on every fresh wizard session and remains unchecked
  after draft, remembered-contact, or authenticated-contact hydration.
- Consent/legal acceptance remains visible outside the collapsed optional Preferences section.
- Required-field communication uses visible copy and accessible labels, not colour alone.

## 5. Behavioral Requirements (EARS)

- THE customer Details form SHALL accept a non-empty name, explicit legal acceptance, and at
  least one of a valid email address or valid UK phone number.
- IF both customer contact fields are empty, THEN THE Details form SHALL associate the message
  `Add an email address or phone number.` with both fields.
- IF a populated contact field is invalid, THEN THE Details form SHALL identify that field's
  format error even when the other contact is valid.
- WHEN the public booking API receives exactly one valid contact, THE booking creation pipeline
  SHALL accept it, preserve it, and represent the omitted contact as an empty string.
- WHEN a customer wizard session initializes or hydrates contacts or a saved draft, THE wizard
  SHALL set legal acceptance to false.
- THE Details step SHALL keep legal acceptance visible independently of optional Preferences.
- THE Details step SHALL visibly identify required inputs, explain that email or phone is
  required, and expose field requirements to assistive technology.
- WHILE the Continue action is disabled, THE Details step SHALL expose a concise reason without
  requiring a submit attempt.
- THE Details step SHALL use minimum 44px targets for its text inputs, disclosure trigger, and
  checkbox rows.
- WHILE WhatsApp updates are unavailable, THE Details step SHALL communicate that state in text
  and SHALL NOT present an enabled opt-in control.

## 6. Verification Criteria and Task Breakdown

Verification criteria:

- Customer Details validation passes for email-only and phone-only contacts, and fails with
  field-addressable errors for neither or malformed populated contacts.
- Public booking request parsing and payload construction preserve email-only and phone-only
  requests without throwing on omitted fields.
- Fresh, remembered-contact, authenticated-contact, current-draft, and legacy-draft paths all
  leave legal acceptance false.
- Details rendering tests prove visible consent, required/alternative contact guidance, disabled
  rationale, unavailable WhatsApp copy, and Details-scoped 44px targets.
- The shipped customer Reserve route is exercised at mobile and desktop widths; ops regression
  tests remain green.

Task breakdown:

1. Add failing tests for customer contact alternatives and public booking payloads, then make the
   smallest schema/payload changes that satisfy them.
2. Add failing tests for fresh consent across reducer and draft hydration, then remove consent
   persistence/restoration.
3. Add failing Details rendering/accessibility tests, then restructure the consent and guidance
   UI with scoped target sizes.
4. Run targeted tests after each green step, then run and record all declared gates with
   `governance:run-gates --spec MS-guest-reserve-contact-consent --record`.
5. Verify the real shipped customer route in a browser at mobile and desktop widths, verify ops
   regressions, and advance the lifecycle with `governance:advance`.
