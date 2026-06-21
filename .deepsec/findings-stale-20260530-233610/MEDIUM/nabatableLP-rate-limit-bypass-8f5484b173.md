# [MEDIUM] Password confirmation endpoint has no app-level rate limit

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish-jobs/[jobId]/retry-google-push/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish-jobs/[jobId]/retry-google-push/route.ts#L68-L98) (lines 68, 81, 82, 98)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route accepts a password, calls verifyUserPasswordConfirmation, and returns a clear failure response for incorrect passwords. There is no consumeRateLimit call keyed by user, restaurant, IP, or action before the Supabase signInWithPassword attempt. This makes the re-authentication gate a password-guessing oracle for anyone with a stolen authenticated session, and all attempts originate from the application backend rather than the browser client.

## Recommendation

Apply consumeRateLimit before password verification using a key such as gbp-retry-password:<userId>:<restaurantId>:<ip>, add backoff/lockout semantics for repeated failures, and keep failure messages generic.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-02)
