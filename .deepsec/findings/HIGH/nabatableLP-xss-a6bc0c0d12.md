# [HIGH] Restaurant profile form persists unsafe external-link schemes

**File:** [`components/ops/restaurants/RestaurantDetailsForm.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/components/ops/restaurants/RestaurantDetailsForm.tsx#L495-L1826) (lines 495, 496, 699, 737, 1305, 1782, 1826)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The form accepts Google Maps and Google Review URLs and submits them through sanitizePayload in both the contact subform and full form. The UI uses URL inputs, but URL inputs do not restrict schemes, and the shared validation only checks parseability. A restaurant admin can save a value such as javascript:alert(1). Those persisted values are later used as public restaurant page anchors and booking email CTA destinations, so a malicious or compromised restaurant admin can create stored XSS that triggers when a guest or staff user clicks the map/review CTA.

## Recommendation

Validate these fields before submit and enforce the same rules server-side. Require https: URLs and preferably allowlist expected hosts such as Google Maps and g.page; reject javascript:, data:, vbscript:, file:, and other non-web schemes before persistence or rendering.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
