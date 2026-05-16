# [MEDIUM] Restaurant creation POST lacks CSRF validation

**File:** [`src/app/api/ops/restaurants/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/route.ts#L114-L153) (lines 114, 115, 134, 150, 153)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `missing-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

POST authenticates with cookie-bound Supabase session state, parses a JSON body, and creates restaurant and membership records through the service-role client, but it never calls validateCsrfToken. The repo already has a double-submit CSRF helper and the onboarding restaurant creation route enforces it. A same-site or otherwise cookie-including forged request can create tenant records in the victim's session.

## Recommendation

Call validateCsrfToken(req) at the start of POST and return 403 on failure. Keep the existing frontend CSRF header behavior, and require the check on all cookie-authenticated mutating ops routes.

## Revalidation

**Verdict:** true-positive

The current POST handler authenticates with the cookie-backed Supabase session, parses req.json(), validates createRestaurantSchema, and writes through the service-role client. It never calls validateCsrfToken, validateCsrfProtectedMutation, withCsrfProtectedMutation, or withOpsMutation. The browser fetchJson helper does add x-csrf-token for legitimate UI calls, but this route never verifies that header against the CSRF cookie. Because Supabase auth cookies are scoped for the root domain and SameSite=Lax, a same-site attacker-controlled subdomain or another cookie-including context can send a credentialed simple request with a JSON body and cause the side effect without reading the response. Cross-site exploitation is limited by SameSite/CORS details, but the repo contract requires backend CSRF checks for unsafe cookie-authenticated mutations. This remains exploitable as a forged restaurant creation in a victim ops session.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)
