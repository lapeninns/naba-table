# Google Business Profile Integration Remediation

## Objective

Implement the approved production-safety remediation for Google Business Profile: exact one-shot write consent, fail-closed controls, typed transport and OAuth/OIDC, credential rotation, epoch fencing, Pub/Sub and Google Updates, retention/privacy controls, FoodMenus protection, operator UI, compatibility, and staging-first operations.

## TODOs

- [x] Wave 0 - Freeze shared contracts, dependencies, strict environment defaults, rollout modes, baseline characterization, and write/content inventories.
- [x] Wave 1A - Add additive database schema, RLS, consent/dispatch RPCs, epoch state, notification registry, Pub/Sub dedupe, retention metadata, rollout allowlist, and Core outbox.
- [x] Wave 1B - Contain unattended and legacy Google writes while preserving read and Core-only compatibility behavior.
- [x] Wave 1C - Harden provider transport, OAuth/OIDC, credential encryption/rotation, mutation permits, Google Updates clients, FoodMenus, notifications, and connection lifecycle.
- [x] Wave 2A - Implement exact preview/consent grants, fail-stop publish execution, terminal queue semantics, and runtime/epoch/rollout enforcement.
- [x] Wave 2B - Implement atomic Core-change outbox coverage for every canonical writer and candidate reconciliation.
- [x] Wave 2C - Implement content-lineage census, backup-aware retention, scrub/delete jobs, no-store/cache/telemetry controls, and disconnect purge.
- [x] Wave 2D - Implement Pub/Sub ingestion, account-scoped notification participation, refresh scheduling, Google-update mask overlays, stale-work fencing, and user notices.
- [x] Wave 3 - Implement the operator settings UI and API client contracts for exact confirmation, state, pending updates, outcomes, revoke, and disconnect.
- [x] Wave 4 - Complete canonical caller migration, structured logging, operational scripts, runbooks, route maps, and release evidence templates.

## Final Verification Wave

- [x] Verify all implementation lanes independently, resolve findings, and record confirmed DoneClaims.
- [x] Run targeted tests, lint, typecheck, coverage, security regression, GBP Playwright, build, verify, and workspace verification where applicable.
- [x] Run fresh rendered UI QA at 375, 768, and 1280 widths with dual independent visual reviewers.
- [x] Run the global five-lane review and debugging audit against the final revision and record evidence.
- [x] Mark external staging, Google, Supabase, backup/PITR, Pub/Sub IAM, OAuth verification, and canary gates passed or explicitly blocked with exact evidence.

The remaining item is intentionally release-blocking: all 18 external readiness artifacts are unverified and the checker fails closed. The final local browser rerun was also sandbox-blocked (`EPERM`); the authenticated post-fix Playwright artifact is 5/5, and the current deterministic product QA has no open blocker.

## Acceptance invariants

- No Google listing mutation reaches the network without a current, exact, one-shot permit bound to tenant, actor, account/profile/location, epoch, request digest, masks, decisions, risk acknowledgements, and snapshot pins.
- Auto-export only discovers candidates. Dispatched grants are never automatically retried; ambiguous outcomes require refresh and fresh approval.
- All asynchronous work persists only when its connection generation, epoch, profile, and location remain current.
- Google-derived content, including caches, telemetry, queues, and recoverable backups, remains within the policy window; owner-authored Core data is preserved.
- Runtime controls and rollout mode fail closed by default.
- Local validation passes; production writes remain disabled until every external release gate passes.

## Delivery

Direct implementation in the shared repository worktree. No branch, pull request, production migration, live Google mutation, or external infrastructure write is authorized by this task.
