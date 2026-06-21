# Dual-Sync Production Invariants

This document freezes the production-safety contract for Google Business Profile dual-sync. It is an operating gate, not a feature spec.

## Scope

Applies to every path that imports Google Business Profile data into Nabatable Core or exports Nabatable Core data to Google, including manual publish, scheduled refresh, auto-export, queued jobs, replay tests, and operator recovery.

## Invariants

1. No publish runs without fresh validation.
   - Read the current Core canonical snapshot.
   - Read the current Google mirror or live canonical snapshot.
   - Compare pinned snapshot hashes and pinned field hashes.
   - Validate field capability and field policy.
   - Validate the section/write-group plan.
   - Reject stale or unsupported decisions before any external write.

2. The UI may be field-level, but execution is section/resource-level.
   - Operator choices remain field-specific for review.
   - Backend publish plans group decisions by direction, section, and write group.
   - Google writes use the smallest supported resource operation and explicit masks.
   - Child operation rows must preserve the selected field-level audit trail.

3. Every syncable field must have policy.
   - Field key and section key.
   - Authority and ownership.
   - Import/export capability.
   - Risk level.
   - Semantic comparator and canonicalizer.
   - Write group or explicit no-write reason.
   - Destructive-write flag.
   - Manual-review requirement.

4. Every external write is auditable.
   - Actor and request id.
   - Decision payload.
   - Pinned hashes and current hashes.
   - Publish batch and operation group.
   - Before/after field hashes.
   - Google update masks or attribute masks.
   - Redacted request summary and response summary where available.
   - Stable failure code and retryability.
   - Final recompute outcome.

4b. Durable provider audit payloads must be redacted before persistence.

- Authorization headers, cookies, access tokens, refresh tokens, id tokens, API keys, client secrets, passwords, credentials, and session values must not be written to durable audit JSON.
- URL/query-string and message strings must redact token-like `access_token`, `refresh_token`, `token`, `key`, and `secret` values before storage.
- Redaction must preserve non-sensitive operator context such as status codes, field keys, update masks, operation ids, and stable failure summaries.
- Dedicated Google request-log rows must store summaries and retention metadata only; raw credentials and unbounded provider payloads do not belong in `dual_sync_google_request_logs`.

4a. Provider preflight capability must be explicit.

- `locations.patch` write groups record `validateOnly` support and delegate the live validation call to the concrete export port.
- `locations.updateAttributes` write groups record `preflightUnsupported: true` and rely on `attributeMask`, supported-attribute checks, preview warnings, and audit.
- `accounts.locations.updateFoodMenus` write groups record `preflightUnsupported: true` and rely on `updateMask=menus`, baseline-hash preflight, high-risk confirmation, and audit.
- Unsupported provider preflight is not a pass to skip review; it is a documented Google API limitation that must be visible in operation-group preflight results.

5. Every production failure must map to an operator state.
   - Reauth required.
   - Location access lost.
   - Quota limited.
   - Google validation failed.
   - Stale decision.
   - Unsupported field.
   - Permission denied.
   - External API timeout or error.
   - Core write failed.
   - Partial publish failed.

6. Remote data changes are staging-first.
   - Supabase is remote-only.
   - Migrations and destructive data changes must be applied and read back on staging before production.
   - Production rollout requires explicit approval and rollback notes.

7. Risky write flows must have targeted rollback controls.
   - The dual-sync API surface and settings workspace are default-on.
   - `GBP_IMPORT_ENABLED` rejects import decisions before Core writes.
   - `GBP_EXPORT_ENABLED` rejects export decisions before operation rows or Google writes.
   - `GBP_AUTO_CANDIDATES_ENABLED` disables manual and scheduled auto-candidate export.
   - `GBP_HIGH_RISK_EXPORTS_ENABLED` rejects high-risk or manual-review exports.
   - `GBP_MENU_SYNC_ENABLED` rejects FoodMenus import/export decisions.
   - `GBP_ATTRIBUTES_SYNC_ENABLED` rejects Google attribute import/export decisions.
   - `GBP_SCHEDULED_REFRESH_ENABLED` disables scheduled cross-tenant Google refresh.

8. Restaurant-scoped pause controls must fail closed.
   - `dual_sync_restaurant_controls` stores one pause row per restaurant and provider.
   - State reads remain available while paused so operators can inspect and resume safely.
   - Publish preview returns rejected `SYNC_PAUSED` decisions, and publish, refresh, auto-export, queued worker execution, and scheduled helpers fail before provider writes or Core writes.
   - The shipped settings workspace must show paused state and disable write-affecting controls.

## Field Risk Matrix

| Section                           | Risk           | Reason                                                           |
| --------------------------------- | -------------- | ---------------------------------------------------------------- |
| Profile name and address          | Critical       | Public identity, SEO, maps, and customer trust impact.           |
| Categories                        | Critical       | Search placement and Google capability constraints.              |
| Regular hours                     | High           | Incorrect hours create immediate customer harm.                  |
| Special hours and service periods | High           | Exceptions are easy to overwrite and hard for operators to spot. |
| Attributes                        | High           | Dynamic Google-defined metadata varies by category and country.  |
| Food menus                        | High           | Full-resource replacement and business-sensitive content.        |
| Service items                     | Medium         | Structured Google-specific data with partial support risk.       |
| Service areas                     | Medium         | Visibility and service-model impact.                             |
| Phone and website/profile copy    | Medium         | Public-facing and customer-impacting, but easier to validate.    |
| Google-owned URLs                 | Low write risk | Read-only or Google-owned; export must remain blocked.           |
| Core-only booking/settings data   | Unsupported    | Not part of Google Business Profile sync.                        |

## Ownership Map

| Ownership class      | Examples                                                                                                 | Production rule                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Core authoritative   | FoodMenus projection, approved public profile copy                                                       | Export only after preview, policy validation, preflight where required, and audit.     |
| Google authoritative | Google Maps URL, review URL, Google-generated metadata                                                   | Import/read only; export stays blocked with clear reason.                              |
| Bidirectional manual | Phone, description, regular hours, service periods, categories, attributes, service areas, service items | Operator must choose import/export/ignore against fresh hashes.                        |
| Review required      | High-risk Google-visible sections and destructive writes                                                 | Publish preview must show section groups, masks, warnings, and manual acknowledgement. |
| Unsupported          | Core-only operational fields                                                                             | Never publish to Google; surface as unsupported or omit from syncable registry.        |

## Rollout Gates

### Local Gate

- Registry policy tests pass for every field.
- Publish planner rejects stale, unsupported, and policy-blocked decisions.
- Lock, idempotency, queue, retry, dead-letter, and operation-group tests pass.
- Fake Google and replay tests cover the supported publish shapes touched by the release.
- UI component tests cover preview, high-risk acknowledgement, queue recovery, and result summaries.
- Feature-flag tests prove import/export, high-risk export, menu, attributes, auto-candidate, and scheduled refresh rollback paths fail closed.
- Restaurant pause/resume tests prove write-affecting paths fail closed before provider/Core mutation.
- `pnpm run typecheck`, `pnpm run lint`, and relevant `pnpm exec vitest ...` commands pass.

### Staging Gate

- Required Supabase migrations are applied to staging.
- Staging readback verifies new tables, indexes, policies, and enum-compatible values.
- Staging cron or scheduler configuration is installed for queue drains when needed.
- Staging route/API checks verify tenant auth, stale decision rejection, queue listing, retry, and dry-run behavior.
- Authenticated shipped-route browser QA verifies preview -> publish -> result and queue recovery.
- No production data or live Google writes are touched during staging proof unless separately approved.

### Production Gate

- Staging evidence is complete and linked from the task harness.
- Rollback path is documented for migrations, scheduler config, and feature flags.
- Production migration/apply commands are approved explicitly.
- Production smoke checks are read-only first.
- First write path is limited to an approved venue and decision set.
- Observability confirms publish batches, operation groups, queue drains, failures, and retries.

### GA Gate

- Metrics and alert-channel delivery exist for queue backlog, dead-letter count, quota failures, reauth failures, stale decisions, and partial publish failures.
- Runbooks exist for reauth, rollback, queue drain failures, dead-letter retry, Google quota, and publish replay. The current runbook lives at `docs/ops/dual-sync-runbooks.md`.
- Golden canonicalization and contract-mask tests cover every supported field family.
- Stored replay fixtures cover representative clean, drifted, stale, failed, and partial-success scenarios.

## Test Strategy

- Unit tests enforce policy completeness, canonicalization, field-state computation, planner grouping, and stale rejection.
- Contract tests assert Google update masks, attribute masks, full-resource FoodMenus behavior, and empty/unsupported values.
- Preflight contract tests assert which Google write groups support provider `validateOnly` and which groups are explicitly `preflightUnsupported`.
- Fake Google tests replace live Google for regression coverage because Google Business Profile has no sandbox.
- Replay fixtures must be deterministic and must avoid secrets, tokens, or live customer payloads.
- Failure injection must cover preflight, before provider call, provider failure, after provider call, mirror refresh, recompute, candidate resolution, and audit update phases.
- UI tests must verify reviewable warnings and stable failure codes; authenticated browser QA remains required on shipped routes before production claims.

## Non-Goals

- This document does not approve production migration or live Google writes.
- This document does not replace task harness evidence.
- This document does not allow harness-only UI proof when shipped-route proof is required.

## Extension Guidance

New GBP field families, write groups, and FoodMenus behavior must follow `docs/sdlc/gbp-dual-sync-extension-guide.md` before implementation.
