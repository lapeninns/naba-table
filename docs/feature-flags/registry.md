# Feature Flag Registry

> Generated via `pnpm tsx scripts/feature-flags/audit.ts` (requires Supabase SERVICE_ROLE env vars). Update this table whenever defaults or overrides change.

| Flag                             | Rationale                                                                                           | Safe Default                         | Rollout Notes                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `holds.strict_conflicts.enabled` | Prevents table hold overlaps at DB level; must stay `true` once enforced.                           | `true`                               | Disable only for emergency rollback; pair with `set_hold_conflict_enforcement(false)` RPC.    |
| `holds.enabled`                  | Enables hold creation for allocator flows; required for strict conflicts.                           | `true`                               | When disabling (not recommended), also remove strict conflicts to avoid inconsistent state.   |
| `allocator.require_adjacency`    | Forces adjacency requirement for merges; disabling while merges enabled risks invalid combinations. | `true`                               | If disabling, also disable `allocator.merges_enabled`.                                        |
| `allocator.merges_enabled`       | Allows allocator to merge tables; depends on adjacency checks.                                      | `true` in dev/staging, gated in prod | Use staged rollout with adjacency requirement in place.                                       |
| `selector.lookahead.enabled`     | Penalises plans that cause future conflicts; high penalty weight required if enabled.               | `true` with non-zero penalty         | If penalty weight = 0 the feature is effectively off; adjust penalty via env before enabling. |

## Audit Workflow

1. Ensure `.env.local` (or environment-specific secret manager) provides the Supabase service role credentials.
2. Run `pnpm tsx scripts/feature-flags/audit.ts` to print current defaults plus overrides for each environment.
3. Copy the output table into `tasks/<slug>/verification.md` for traceability when toggling flags.
4. Require two approvers for any change: one from the owning squad, one from platform/ops.
5. For risky combinations, add a short justification in PR description and link to the relevant observability alert screenshots.

## Unsafe Combinations (Warnings surfaced at runtime)

The server now emits console warnings when:

- `holds.enabled` is `true` but `holds.strictConflicts` is `false`.
- `allocator.merges_enabled` is `true` while `allocator.require_adjacency` is `false`.
- `selector.lookahead.enabled` is `true` with `penaltyWeight = 0`.

These warnings appear once per process startup and should be treated as blockers before deployment reaches production.

## Change Approval Process

- Open a PR referencing the relevant task folder and include the updated audit table.
- Collect approvals from the owning squad lead _and_ the platform/ops representative.
- Once merged, update environment overrides via Supabase dashboard or MCP automation.
- Record the change (with timestamp, environment, approvers) in `docs/feature-flags/registry.md` under a new dated bullet.

### Change Log

- _2025-11-05_ — Registry established; safety warnings added; audit script introduced.
