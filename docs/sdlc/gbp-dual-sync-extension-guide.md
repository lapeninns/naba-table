# GBP Dual-Sync Extension Guide

Use this guide before adding any new Google Business Profile field family, write group, or FoodMenus behavior. It extends the safety contract in `docs/sdlc/dual-sync-production-invariants.md`.

## Extension Rules

- Add fields through the dual-sync registry, not ad hoc route or component code.
- Every field needs section key, field key, authority, risk, import/export capability, comparator, canonicalizer, delete policy, write group, and destructive-write status.
- Core-only, Google-owned, or operational-only fields must be non-exportable and either omitted from syncable views or marked unsupported with a clear reason.
- Public Google writes must travel through preview, pinned hashes, capability validation, runtime flags, pause checks, locks, edit budgets, preflight where available, and audit.
- Legacy `/google-business/**` routes are compatibility surfaces; new extension work should use canonical `/google-business-profile/**` or `/dual-sync/**` paths.

## Source Touchpoints

| Layer                    | Files                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Registry and policy      | `server/dual-sync/registry/**`, `server/dual-sync/types.ts`, `server/dual-sync/registry/field-policy-versions.ts`             |
| Snapshot extraction      | `server/dual-sync/snapshots/**`, `server/google-business-profile/business-info/**`, FoodMenus snapshot files                  |
| Comparison and hashing   | `server/dual-sync/state/compute.ts`, `server/dual-sync/hashing.ts`, relevant canonicalizers                                   |
| Planner and preflight    | `server/dual-sync/publish/planner*.ts`, `server/dual-sync/publish/preflight.ts`                                               |
| Provider/Core ports      | `server/dual-sync/publish/ports/**`, `server/dual-sync/core-writes/**`                                                        |
| UI review state          | `src/components/features/restaurant-settings/dual-sync/**`, `src/components/features/restaurant-settings/gbp-drift/**`        |
| API routes               | `src/app/api/ops/restaurants/[id]/dual-sync/**`                                                                               |
| Runbooks and safety docs | `docs/sdlc/dual-sync-production-invariants.md`, `docs/ops/dual-sync-runbooks.md`, `docs/ops/gbp-operational-safety-review.md` |

## Capability Checklist

- Define whether the field is importable, exportable, ignorable, or unsupported.
- Define whether manual review is required.
- Define the write group and Google update mask or attribute mask.
- Define blocked reasons for unsupported direction choices.
- Define destructive-write behavior and whether a clear/delete can happen.
- Define rollback flag coverage if the field belongs to menu, attributes, scheduled, high-risk, import, or export families.
- Add field policy version coverage when the registry behavior changes.

## Publish Checklist

- Preview rejects missing pinned field hashes.
- Preview rejects stale Core or GBP snapshot hashes.
- Preview rejects section/key mismatches and unsupported fields.
- Preview groups decisions by direction, section, and write group.
- Publish repeats validation before operation rows or provider/Core writes.
- Publish records operation groups, field operations, masks, failures, and recompute outcome.
- Queue mode keeps idempotency keys stable and does not execute inline.
- Pause/flag/lock/edit-budget failures happen before external mutation.

## FoodMenus-Specific Rules

- Treat FoodMenus as high-risk because Google uses a full-resource replacement shape.
- Use stable projected identities for menus, sections, items, modifiers, and options.
- Preserve baseline hashes and projection metadata through preview and publish.
- Google FoodMenus export must use `updateMask=menus`.
- Provider `validateOnly` is unsupported for FoodMenus; do not treat `preflightUnsupported` as approval to bypass preview or confirmation.
- A FoodMenus export path must prove either the existing alternate baseline contract or a new explicitly tested provider-safety contract before live writes.
- Keep `GBP_MENU_SYNC_ENABLED=false` as the fast rollback path for menu import/export.

## Required Tests

- Registry test for policy completeness and blocked reasons.
- Snapshot/canonicalization tests for Core and Google representations.
- Hash/comparator tests for unchanged, drifted, empty, and deleted values.
- Planner tests for stale pins, unsupported fields, group masks, and warning codes.
- Preflight/port tests for Google update masks or attribute masks.
- Orchestrator tests for pause, flags, locks, edit budget, operation rows, request-log redaction, and failure phases.
- UI tests for field row controls, high-risk warnings, disabled unsupported actions, preview dialog, and publish results.
- Shipped-route Playwright proof for any user-visible state or control change.

## Rollout Path

1. Add registry policy and canonicalization with no publish route behavior.
2. Add read-only state and UI rendering.
3. Add preview support with rejected unsupported/export-disabled cases.
4. Add provider/Core port implementation behind rollback flags.
5. Add queue, replay, fake-Google, and request-log coverage.
6. Verify locally with targeted Vitest, Playwright shipped-route proof, typecheck, lint, and the GBP QA command in mock mode.
7. Run staging-first remote readback and dry-run checks before production.
