# [MEDIUM] Cookie-authenticated DELETE mutation lacks CSRF validation

**File:** [`src/app/api/ops/bookings/[id]/tables/[tableId]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/bookings/[id]/tables/[tableId]/route.ts#L29-L82) (lines 29, 41, 45, 79, 82)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The DELETE handler uses the Supabase route-handler cookie session and performs a service-role unassignment, but it never calls withCsrfProtectedMutation or validateCsrfProtectedMutation. This violates the repository's unsafe mutation contract and leaves the mutation without the same CSRF protection used by nearby table assignment routes.

## Recommendation

Wrap DELETE with withCsrfProtectedMutation(request, ...) or call validateCsrfProtectedMutation before any auth-dependent mutation, matching the sibling assignment handlers.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
