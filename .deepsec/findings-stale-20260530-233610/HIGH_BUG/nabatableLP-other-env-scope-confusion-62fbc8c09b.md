# [HIGH_BUG] Feature flag override scope can silently fall back to development

**File:** [`server/feature-flags-overrides.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/feature-flags-overrides.ts#L26-L37) (lines 26, 27, 33, 37)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** medium • **Slug:** `other-env-scope-confusion`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getEnvironmentScope always prefers env.node.appEnv, but APP_ENV is defaulted to development by the env schema even when a production deployment is detected via VERCEL_ENV. If APP_ENV is omitted or mis-set on staging or production, this helper queries feature_flag_overrides with the wrong environment and can ignore staging/production rollout or safety overrides for allocator and booking-capacity behavior.

## Recommendation

Require an explicit APP_ENV for staging and production targets, fail closed when it is missing or inconsistent with VERCEL_ENV, and add regression tests for VERCEL_ENV=production without APP_ENV.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-29)
