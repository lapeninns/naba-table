# [MEDIUM] Cookie-authenticated drink item creation lacks CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/drinks/items/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/drinks/items/route.ts#L50-L88) (lines 50, 56, 61, 88)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-csrf`

## Finding

The POST handler authenticates the admin via cookie-backed Supabase auth, parses request.json(), and then writes drink menu data with upsertDrinkItem, but it never validates the repository's CSRF token with validateCsrfToken. The frontend helper emits x-csrf-token, but this route does not enforce it. A same-site cross-origin page, or HTML injection on the public root host, can submit a form POST with a text/plain body that Request.json() will parse as JSON, causing a logged-in owner/manager browser to create drink items. The per-restaurant admin check prevents anonymous and cross-tenant access, but it does not stop CSRF against an authenticated admin session.

## Recommendation

Reject unsafe methods unless validateCsrfToken(request) succeeds, ideally before parsing the body, and consider enforcing an application/json Content-Type for JSON API mutations.
