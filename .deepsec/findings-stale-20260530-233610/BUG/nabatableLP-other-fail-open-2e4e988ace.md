# [BUG] Production precheck exits successfully after failures

**File:** [`scripts/production-precheck.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/production-precheck.ts#L72-L73) (lines 72, 73)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-fail-open`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The precheck catches any connection or query error and logs it, but does not rethrow or set a non-zero exit code. Automation or operators relying on this script as a gate can receive a successful process exit even when the production pre-optimization checks did not run or failed midway.

## Recommendation

Set process.exitCode = 1 in the catch block or rethrow the error after logging so failed prechecks fail closed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
