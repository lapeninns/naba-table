# Google Business Profile Dual-Sync Extension Guide

This guide closes the GBP-009 documentation deliverable. Use it when adding a new Google Business Profile dual-sync section, field family, write group, or operator workflow.

## Extension Principles

- Extend the dual-sync registry; do not create a parallel GBP workflow.
- Keep UI choices field-level and backend execution section/write-group-level.
- Add field policy before exposing actions.
- Treat unsupported provider behavior as a first-class contract, not an implementation detail.
- Preserve per-field audit even when Google requires section/resource writes.
- Keep imports conservative when Google data is lossy or cannot map cleanly to Nabatable Core.

## Required Extension Steps

1. Add canonical snapshot support for Core and Google values.
2. Add registry fields with `withFieldPolicy`.
3. Add semantic canonicalizers and comparators.
4. Assign authority, risk, import/export capability, write group, no-write reason, manual review, and destructive-write policy.
5. Add planner and publish-preview coverage for stale pins, unsupported fields, disabled flags, and section grouping.
6. Add concrete import/export ports only after the write strategy is clear.
7. Add provider mask/preflight strategy and request-log audit summaries.
8. Add UI blocked reasons and high-risk review copy.
9. Add route, service, hook, and QA docs if the extension creates a new operator surface.
10. Add staging-first rollout and rollback notes before production use.

## Field Policy Template

Every syncable field needs this contract:

```ts
{
  fieldKey: 'section.family.identity',
  sectionKey: 'section',
  authority: 'core_authoritative' | 'google_authoritative' | 'bidirectional_manual' | 'review_required' | 'import_only' | 'export_only' | 'read_only' | 'unsupported',
  riskLevel: 'low' | 'medium' | 'high' | 'critical',
  importable: true,
  exportable: false,
  requiresManualReview: true,
  googleWriteGroup: 'location.profile',
  noWriteReason: 'Google does not support writing this field.',
  semanticComparator: 'text',
  canonicalizer: 'canonicalizeText',
  destructiveWritePossible: false,
}
```

The source type is `DualSyncFieldPolicy` in `server/dual-sync/registry/types.ts`; defaults are derived in `server/dual-sync/registry/policy.ts`.

## Unsupported-Field Rules

Use `unsupported` when a field cannot safely sync today. Use `read_only` or `google_authoritative` when it can be displayed but not exported. Use `noWriteReason` for blocked copy that operators can understand.

Required tests:

- Unknown field is rejected.
- Section mismatch is rejected.
- Non-importable field cannot be imported.
- Non-exportable field cannot be exported.
- Disabled runtime flag rejects the field before mutation.
- Missing write group rejects export.
- UI exposes the blocked reason.

## Write-Group Rules

| Extension type                           | Required write group behavior                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Profile scalar                           | Use explicit `locations.patch` update masks.                                                         |
| Hours or periods                         | Group selected fields into one section-level mask strategy.                                          |
| Categories, service areas, service items | Merge selected Core rows with unselected Google rows before list patching.                           |
| Attributes                               | Use `attributeMask`; verify metadata support because attributes vary by category/country.            |
| FoodMenus                                | Publish deterministic full projection only after baseline/hash preflight and high-risk confirmation. |
| Core-only operational data               | Keep unsupported or omit from the sync registry.                                                     |

## FoodMenus Extension Contract

FoodMenus is the reference model for high-risk section extension:

- Local source of truth remains the rich Nabatable menu model.
- Google receives a deterministic public projection.
- Projected item fields are review units only.
- Export is full-resource replacement through `updateMask: ['menus']`.
- Import is suggestion-only unless a Google item maps cleanly to a local identity.
- Missing Google rows must not delete local menu items without explicit approval.
- The default dual-sync provider preflight currently fails FoodMenus groups because Google has no `validateOnly`; production export needs an accepted alternate baseline/hash preflight path.

Source-backed files:

- Registry: `server/dual-sync/registry/food-menus.ts`
- Export port: `server/dual-sync/publish/ports/food-menus-export.ts`
- Publish service: `server/google-business-profile/food-menus-publish-service.ts`
- Storage foundation: `supabase/migrations/20260502190006_add_gbp_foodmenus_sync_storage.sql`
- Architecture notes: [`docs/google-business-profile-changes-architecture.md`](google-business-profile-changes-architecture.md)

## Route And API Documentation

When an extension adds routes, update [`docs/ops/gbp-route-map.md`](ops/gbp-route-map.md) with:

- host context
- external path
- internal file or handler
- proxy behavior
- auth expectation
- canonical or legacy classification
- caller evidence
- test evidence

Do not delete or repurpose legacy routes without caller evidence and production traffic checks.

## QA Expectations

Minimum source-level tests:

- Registry policy completeness.
- Canonicalization and hashing fixtures.
- Publish planner rejects stale, unsupported, disabled, and mismatched decisions.
- Mask/preflight contract tests for the new write group.
- Fake Google success and provider-failure paths.
- Operation-group and per-field audit rows.
- UI blocked reasons and preview warnings when UI is affected.

For GBP dual-sync routes and UI, include the existing focused command when relevant:

```sh
pnpm run qa:gbp-dual-sync
```

## Production Handoff

An extension is not production-ready until the task handoff includes:

- exact fields and write groups added
- authority and risk decisions
- unsupported-field decisions
- route/API identity rows, or `Not applicable`
- migration and staging readback evidence, if data tables changed
- feature flags and rollback controls
- QA command outcomes
- shipped-route browser proof for UI changes
- explicit production caveats
