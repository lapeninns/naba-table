# [HIGH_BUG] GBP proof/publish target check can use the wrong Supabase project

**File:** [`scripts/prove-gbp-foodmenus-publish.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/prove-gbp-foodmenus-publish.ts#L293-L404) (lines 293, 295, 341, 358, 404)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-target-safety-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

assertTargetEnv() verifies only NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL against the selected target's project ref, but the script later obtains its service-role client from getServiceSupabaseClient(). That helper can route to SUPABASE_READ_REPLICA_URL when the read-replica feature flag is enabled on non-production targets. The script then reads GBP credentials/context and, in publish mode, writes FoodMenus to Google using that context. A mixed environment can therefore produce a staging-labeled proof or publish run backed by another Supabase project, including production, bypassing the intended target guard.

## Recommendation

Validate resolveServiceRoleSupabaseUrl() against the selected target before any GBP context lookup or publish, and fail if it differs from the validated primary URL for write-capable modes. Also require API project-ref checks to validate the expected Supabase hostname, not just the first DNS label.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
