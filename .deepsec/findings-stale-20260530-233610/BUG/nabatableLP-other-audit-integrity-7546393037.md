# [BUG] Backfill can attribute lifecycle history to an unrelated user

**File:** [`scripts/backfill-review-emails.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/backfill-review-emails.ts#L135-L297) (lines 135, 136, 141, 297)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-audit-integrity`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

resolveActorId first tries the earliest restaurant membership user, but if that user is missing or cannot be verified it falls back to supabase.auth.admin.listUsers({ perPage: 1 }) and returns the first auth user globally. That actor id is then written as p_history_changed_by for the booking state transition. During an all-restaurant apply run, any restaurant without a valid membership can have generated check-in/check-out audit history attributed to an arbitrary user from another tenant, corrupting the audit trail. This is not remotely exploitable from the reviewed script, but it is a real data-integrity bug.

## Recommendation

Remove the global first-user fallback. Either skip the restaurant unless a valid restaurant membership actor is found, require an explicit ACTOR_ID_OVERRIDE, or use a dedicated verified system/backfill actor and record the backfill reason in metadata.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-19)
