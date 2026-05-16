# [HIGH_BUG] Null pinned hashes disable drift checks for fields that were absent

**File:** [`server/dual-sync/publish/orchestrator.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/dual-sync/publish/orchestrator.ts#L160-L230) (lines 160, 168, 215, 230)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-drift-check-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The per-field drift checks only run when pinnedCoreHash or pinnedGbpHash is neither null nor undefined. However hashCanonicalJson returns null for absent/null values, and the UI/auto-export paths can legitimately pin null when the operator viewed an absent field or when a queued export represents a deletion. If that field changes from null to a real value before publish, the orchestrator skips the comparison instead of detecting drift. The snapshot-level hash checks do not compensate because mismatches are computed and then ignored.

## Recommendation

Distinguish not provided from expected null. Require pin properties on publish decisions and compare beforeCoreHash/beforeGbpHash even when the expected value is null, or model pins as an explicit object such as { present: true, hash: string | null }. Abort on snapshot-pin mismatch when field-level pins are absent.

## Revalidation

**Verdict:** fixed

Publish decisions are now validated with `validatePublishDecisionPins`, which requires both `pinnedCoreHash` and `pinnedGbpHash` to be present as either a string or explicit `null`. `buildPublishPlan` and `runPublish` compare `beforeCoreHash` and `beforeGbpHash` directly against those pins, so an expected absent value is enforced instead of skipped. The publish and preview route schemas also reject omitted field-level pins. Focused evidence: `tests/server/dual-sync-publish-planner.test.ts`, `tests/server/dual-sync-publish-orchestrator.test.ts`, `tests/server/dual-sync-publish-route.test.ts`, and `tests/server/dual-sync-publish-preview-route.test.ts` passed on 2026-05-16.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)
