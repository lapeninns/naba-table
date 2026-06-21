# [HIGH] PostHog forwards full URL query tokens to analytics

**File:** [`lib/posthog/provider.tsx`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/lib/posthog/provider.tsx#L99-L119) (lines 99, 107, 118, 119)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `other-token-leakage`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The provider's before_send hook only suppresses one noisy exception and does not redact URL-bearing event properties before events are sent. The related src/instrumentation-client.ts queues/captures PostHog pageview events with $current_url set to resolvedTargetUrl.href, including the full query string, and this provider flushes that queue after PostHog initializes. Auth magic links are built with token_hash in the URL query string, so visiting an auth callback or similar one-time-token route can disclose usable or recently usable tokens to PostHog/project users/logs. The explicit analytics prop sanitizer does not mitigate this path because these pageview properties bypass it.

## Recommendation

Redact URL query strings before capture and in before_send as a defense-in-depth guard. Strip or replace sensitive params such as token_hash, code, state, invite tokens, confirmation tokens, and redirect URLs; consider dropping analytics entirely on auth callback/token routes.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-10)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-19)
