# GBP Final Review — Security Lane

## recommendation

PASS

No CRITICAL or HIGH security finding was reproduced in the current GBP remediation worktree relative to base `a583de5d278b2cb5fd1bda248648a8c303f8c35e` (supplied fingerprint `0235db03acbb5197759bc385855ea8b331068c3dd9e4de957b12ac6116587b2d`).

## originalIntent

Ship the full Google Business Profile remediation with fail-closed tenant and authorization boundaries, one-shot fenced writes, safe OAuth/OIDC and Pub/Sub ingress, bounded fixed-origin provider transport, protected credentials, privacy-safe logs and retention, and least-privilege database access.

## desiredOutcome

Operators can connect and manage a restaurant's GBP integration without cross-tenant access or credential disclosure; provider and Pub/Sub inputs are authenticated and parsed at explicit boundaries; Google writes require exact, non-replayable grants and rollout controls; durable data and RPCs are service-role constrained; and sensitive responses, logs, analytics, and retained content remain bounded and private.

## userOutcomeReview

The reviewed source implements the requested security controls and the local adversarial suite reproduces them. Route helpers enforce signed-in/admin restaurant access before service-role or provider work; OAuth uses browser state-cookie matching, server-side hashed state/nonce records, tenant/user/fence checks, one-active-attempt constraints, RS256 issuer/audience/nonce/`azp` validation, and atomic consumption. Provider clients use fixed Google origins, reject absolute/network paths and protected-header overrides, disable redirects, apply total deadlines, cap response streams, and schema-parse responses. Credentials use AES-256-GCM with random 96-bit IVs, key IDs, external-profile/column AAD, decrypt-only legacy support, and compare-and-swap rewrap. GBP writes are issued/claimed/dispatched/finalized through tenant-, profile-, generation-, consent-, hash-, expiry-, and lease-bound RPCs; direct table mutation is revoked. Pub/Sub validates Google JWT issuer/audience/signature and verified service-account email before parsing or persistence, binds the configured subscription, hashes payloads, and atomically deduplicates/enqueues. Reviewed responses use no-store controls; audit/error persistence redacts token-like keys; retention paths are capped and dry-run capable.

## blockers

None.

## direct programming / remove-ai-slops security pass

- Boundary parsing is substantive rather than implementation-mirroring: hostile origin/path/header, malformed JWT/claims, oversized/malformed provider response, malformed Pub/Sub envelope, replay/stale grant, tenant mismatch, and credential-AAD mismatch tests exercise observable rejection paths.
- No deletion-only security tests, tautological expected values, prompt/prose assertions used as security proof, or unnecessary production parsing/normalization were relied upon for this verdict.
- Mocked route tests are supplemented by direct schema/RPC source assertions and domain-level adversarial tests. Remote database behavior is correctly kept as an external gate rather than inferred from mocks.
- The very large migration is security-sensitive but cohesive as the atomic GBP safety foundation; its direct privilege, RLS, fence, lease, and concurrency evidence is material. Module-size/style preferences are not security blockers.
- Added runtime dependencies `jose@6.1.3` and `ky@2.0.2` are exactly pinned in `package.json` and integrity-pinned in `pnpm-lock.yaml`. The lockfile also contains broad tooling transitive churn caused by React diagnostic tooling; no runtime security defect was demonstrated, but release review should keep that scope visible.

## checkedArtifactPaths

- `supabase/migrations/20260809120000_gbp_write_safety_foundation.sql`
- `server/google-business-profile/clientTransport.ts`
- `server/google-business-profile/responseBody.ts`
- `server/google-business-profile/clientAuth.ts`
- `server/google-business-profile/clientIdentity.ts`
- `server/google-business-profile/oauthNonce.ts`
- `server/google-business-profile/credentialEnvelope.ts`
- `server/google-business-profile/crypto.ts`
- `server/google-business-profile/serviceAuthorizationFlow.ts`
- `server/google-business-profile/serviceAuthorizationRuntime.ts`
- `server/dual-sync/publish/exact-consent/**`
- `server/google-business-profile/writePermit*.ts`
- `server/dual-sync/pubsub/**`
- `src/app/api/webhooks/google-business-profile/pubsub/route.ts`
- `src/app/api/ops/google-business-profile/callback/route.ts`
- `server/dual-sync/retention/**`
- `server/dual-sync/publish/google-audit.ts`
- `server/dual-sync/publish/google-request-logs.ts`
- `config/env.schema.ts`, `lib/env.ts`, `package.json`, `pnpm-lock.yaml`
- `.omo/evidence/gbp-wave1a-schema*`
- `.omo/evidence/gbp-wave3-deepsec-plausible*`
- `.omo/evidence/gbp-wave4-gate-review.md`
- `docs/ops/gbp-operational-safety-review.md`
- `docs/ops/gbp-production-wiring-checklist.md`

## reproducedEvidence

- Local Vitest binary: PASS, 39 files / 330 tests. This combined the repository security regression selection with GBP schema privileges, OIDC identity, credential crypto, Pub/Sub route, exact-consent/grant, privacy/retention, and final-control suites.
- `git diff --check`: PASS.
- `pnpm security:regression`: NOT EXECUTED by the pnpm wrapper because its registry signature/version-switch check failed closed while network access was unavailable. The exact script's tests were executed through `./node_modules/.bin/vitest` and passed.
- `pnpm-lock.yaml` local SHA-256: `2a6348200f15f5d7c00474d32985155c4b9be700ef8e3e9b0613b9cea132a539`.

## notes (non-blocking)

- `server/dual-sync/pubsub/parser.ts` calls `request.arrayBuffer()` before checking the actual 64 KiB size when `Content-Length` is absent. Authentication precedes this read and only the configured Google push identity can reach it, so this was not rated HIGH; incremental stream enforcement would provide stronger defense in depth.
- The canonical OAuth callback does not supply `expectedRestaurantId`, while `consumeOAuthStateRecord` currently requires it. This appears to make the canonical completion path fail closed. It is a functional integration concern, not a security bypass, and is outside this security-only blocking threshold; the functional gate should verify it.

## externalStagingGates

These remain explicitly unverified locally and must pass before production release:

- Applied Supabase migration checksum plus remote RLS/RPC privilege and concurrency readback.
- Live rollout mode, two canary grants, restoration/revocation census, and flags-off rollback evidence.
- Deployed Google OAuth redirect/client configuration and a staging OIDC/state/nonce completion journey.
- Pub/Sub topic/subscription identity, IAM binding, audience, DLQ, retry policy, and signed push evidence.
- Credential keyring rotation dry-run/readback without plaintext exposure.
- Backup/PITR, retention dry-run/archive/delete census, and request-log/content retention evidence.
- Deployed Vercel environment values, cron installation/authentication, and traffic-based legacy-route retirement evidence.
- Registry-backed frozen-lockfile/package-manager signature verification in a network-enabled trusted build environment.

## exactEvidenceGaps

- No live staging/production systems were accessed; all external gates above remain open.
- The package-manager signature wrapper could not verify/download pnpm in this restricted environment, so frozen-lockfile installation was not independently reproduced in this lane.
- No single consolidated final security-review report preceding this one covered every named class; direct source inspection and the reproduced 330-test matrix supply local coverage.
- No ulw-loop plan exists, so the requested fallback report path `.omo/evidence/gbp-final-review-security.md` was used.
