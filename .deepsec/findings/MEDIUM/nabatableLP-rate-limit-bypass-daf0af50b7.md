# [MEDIUM] Authenticated users can create unlimited restaurants through onboarding

**File:** [`src/app/onboarding/profile/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/onboarding/profile/page.tsx#L12) (lines 12)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This page renders OnboardingWizard at the restaurant profile step. The imported ProfileStep POSTs to `/api/onboarding/restaurant`, and that route validates CSRF plus authentication but does not call `consumeRateLimit` or enforce a per-user restaurant creation quota before creating a restaurant and owner membership with the service-role client. An authenticated user can automate tenant creation to pollute data or consume database resources.

## Recommendation

Add a backend rate limit keyed by authenticated user id and client IP, and enforce a product-level quota or onboarding-state invariant before creating another restaurant for the same user.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
