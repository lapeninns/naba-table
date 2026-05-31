# [MEDIUM] Raw backend error messages are reflected from dual-sync candidate cancellation

**File:** [`src/app/api/ops/restaurants/[id]/dual-sync/candidates/[candidateId]/cancel/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/restaurants/[id]/dual-sync/candidates/[candidateId]/cancel/route.ts#L24-L63) (lines 24, 48, 62, 63)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route accepts any non-empty candidateId, then calls cancelOutboundCandidate with a service-role Supabase client. If Supabase/Postgres throws, the catch block returns error.message directly via dualSyncErrorResponse. Because dual_sync_outbound_candidates.id is a uuid column, an authenticated restaurant admin can trigger a raw database error with a non-UUID candidateId and receive internal backend details. The same pattern would expose future service-role database errors from this mutation path.

## Recommendation

Validate candidateId as a UUID before querying, log the detailed backend error server-side only, and return a generic 500 response such as "Unable to cancel dual-sync candidate" to clients.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-30)
