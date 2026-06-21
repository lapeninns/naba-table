# [BUG] Documented production apply confirmation is insufficient for the delegated runner

**File:** [`scripts/rollout-gbp-foodmenus-storage.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/rollout-gbp-foodmenus-storage.ts#L36-L181) (lines 36, 39, 150, 181)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-rollout-confirmation-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The wrapper documents and enforces CONFIRM_GBP_FOODMENUS_PRODUCTION_MIGRATION=true for production apply, then delegates the actual SQL apply to scripts/apply-sql-file.ts. That delegated runner has its own production guard requiring CONFIRM_PRODUCTION=true, but this wrapper neither documents that second variable nor maps the wrapper-specific confirmation into the child environment. A production apply run following this script's usage text will pass the wrapper check and then fail in the delegated runner after the pre-apply verification step. This does not weaken production safety, but it makes the production rollout path misleading and operationally broken.

## Recommendation

Either document and preflight both confirmation variables before running the before-apply verification, or pass a child environment that sets CONFIRM_PRODUCTION=true only after the wrapper-specific production confirmation and project-ref guard have passed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
