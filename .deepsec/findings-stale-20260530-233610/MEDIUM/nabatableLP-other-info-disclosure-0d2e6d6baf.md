# [MEDIUM] Raw backend errors are returned from booking lookups and mutations

**File:** [`src/app/api/bookings/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/bookings/[id]/route.ts#L837-L1944) (lines 837, 839, 861, 894, 1184, 1604, 1780, 1944)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Several error paths serialize internal Error/Supabase objects back to the client. respondWithGuardError includes GuardError.details in JSON, and processDashboardUpdate populates those details with Supabase errors from tenant and service booking lookups. Other catch blocks return stringifyError(error). Because bookingId is accepted as an arbitrary route string before UUID validation, an authenticated caller can trigger PostgREST/DB errors such as invalid UUID syntax and receive backend messages, codes, details, or hints instead of a stable public error. This leaks internal implementation details useful for probing.

## Recommendation

Validate bookingId as a UUID before every DB access. Do not include raw error.message, Supabase error objects, hints, or details in API responses; log them server-side and return a fixed public code/message.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-27)
