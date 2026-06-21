# [HIGH_BUG] Feature flag overrides are scoped by NODE_ENV instead of APP_ENV

**File:** [`server/feature-flags-overrides.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/feature-flags-overrides.ts#L26-L35) (lines 26, 27, 31, 35)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-env-scope-confusion`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

getEnvironmentScope uses env.node.env, which is NODE_ENV, to query feature_flag_overrides.environment. In deployed Next.js environments, staging and production commonly both run with NODE_ENV=production while APP_ENV distinguishes staging from production. This causes staging to read production-scoped overrides and ignore staging-scoped overrides, undermining staged rollout and environment separation for flags that affect booking allocation and hold-conflict behavior.

## Recommendation

Scope override lookup with env.node.appEnv, and add tests for NODE_ENV=production with APP_ENV=staging to ensure staging reads only staging overrides.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-29)
