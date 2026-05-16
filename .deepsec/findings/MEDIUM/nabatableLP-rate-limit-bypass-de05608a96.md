# [MEDIUM] Unthrottled password confirmation oracle

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish-jobs/[jobId]/retry-google-push/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish-jobs/[jobId]/retry-google-push/route.ts#L82-L98) (lines 82, 88, 98)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler calls verifyUserPasswordConfirmation() before validating that draftId/jobId identify a real retryable publish job. With arbitrary route IDs, a wrong password returns the PasswordConfirmationError response, while the correct password proceeds into retryGoogleBusinessProfileWorkflowGooglePush() and then returns job-specific errors such as not found or invalid state. There is no consumeRateLimit() or equivalent throttle in this handler or in server/auth/password-confirmation.ts, so an attacker with a stolen admin session can online-guess the victim user's Supabase password.

## Recommendation

Validate the draft/job/action eligibility before password confirmation, add a strict rate limit keyed by user ID, restaurant ID, action, and client IP before calling verifyUserPasswordConfirmation(), and consider returning generic failure responses for confirmation failures.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
