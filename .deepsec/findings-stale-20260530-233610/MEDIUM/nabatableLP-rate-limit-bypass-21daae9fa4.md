# [MEDIUM] Rate limit runs after expensive dialog data loaders have already started

**File:** [`src/app/api/ops/bookings/[id]/dialog/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/bookings/[id]/dialog/route.ts#L38-L65) (lines 38, 50, 54, 65)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

After authorization, the handler starts requireApiRateLimit, loadBookingDetailPayload, and loadAssignmentContextPayload in the same Promise.all at lines 38-63. Even when the limiter returns a 429 at line 65, the service-role booking detail query, assignment-context queries, and conflict computation have already run. An authenticated restaurant member who exceeds the dialog limit can continue forcing the expensive backend work, so the rate limit does not protect database/resource consumption for this endpoint.

## Recommendation

Check and return on the rate limit immediately after authorization, before creating tenant service clients or starting the booking detail and assignment-context loaders. If needed, add a coarse user/IP limiter before tenant-specific work as well.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-06)
