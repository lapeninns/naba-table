# [MEDIUM] State-changing restaurant ops requests lack server-side CSRF enforcement

**File:** [`src/services/ops/restaurants.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/services/ops/restaurants.ts#L1250-L1532) (lines 1250, 1266, 1296, 1337, 1353, 1371, 1383, 1413, 1436, 1450, 1464, 1479, 1495, 1509, 1520, 1532)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This service issues many cookie-authenticated state-changing requests for restaurant settings, hours, service periods, turn bands, email templates, test sends, and Google Business Profile workflows. `fetchJson` adds an `x-csrf-token` header for legitimate clients, but tracing the corresponding `src/app/api/ops/restaurants/**` route handlers shows no `validateCsrfToken` checks, and `src/proxy.ts` only sets the CSRF cookie. Cookie-sending forged requests can therefore trigger mutations that do not require password confirmation.

## Recommendation

Call `validateCsrfToken(req)` at the start of every mutating ops route before parsing the body or performing side effects, and return 403 or 419 on failure.

## Revalidation

**Verdict:** true-positive

The client service uses fetchJson for most restaurant mutations, and fetchJson attaches x-csrf-token for legitimate browser calls, but several corresponding route handlers still do not validate that token. Some listed paths are now protected, notably PATCH /api/ops/restaurants/[id], DELETE /api/ops/restaurants/[id], logo upload, and turn-bands; password confirmation also reduces exploitability for some Google Business Profile publish/sync actions. However, business-context PUT, operating-hours PUT, service-periods PUT, email-template PATCH/DELETE/test-send, Google Business Profile link/disconnect, and workflow draft/preflight routes rely on session/admin checks without withCsrfProtectedMutation or validateCsrfProtectedMutation. A concrete no-body example is POST /api/ops/restaurants/{id}/google-business-profile/drafts, which creates a workflow draft after admin-session authorization and requires no CSRF token or password. The email template test-send endpoint is another state-changing POST without CSRF enforcement. Supabase auth cookies are root-domain SameSite=Lax, so same-site root/app contexts can send the victim’s cookies, and the proxy only issues the CSRF cookie rather than enforcing it. The finding is therefore real, although it should be read as applying to a subset of the listed restaurant mutation surface rather than every method in the service.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
