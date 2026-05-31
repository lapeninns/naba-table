# [MEDIUM] Rejection analytics allows unbounded date-range reads without rate limiting

**File:** [`server/ops/rejections.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/ops/rejections.ts#L155-L172) (lines 155, 156, 161, 167, 168, 171, 172)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The shipped /api/ops/dashboard/rejections route forwards user-controlled from/to query parameters into getRejectionAnalytics after only checking restaurant membership. The helper parses any valid ISO timestamps and applies them directly to the observability_events created_at range, with no maximum window, while the route has no requireApiRateLimit call unlike the adjacent summary, heatmap, and changes dashboard routes. A malicious or compromised restaurant member can repeatedly request very large ranges such as 1970-to-future to force repeated service-role reads and JSON processing of up to the default 5000 observability rows per request.

## Recommendation

Validate from/to semantically at the API boundary, enforce a maximum lookback/window matching the UI presets or a documented operational limit, reject inverted ranges, and add per-user/per-restaurant rate limiting before calling getRejectionAnalytics. Also clamp any helper-level limit to a safe maximum.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-02)
