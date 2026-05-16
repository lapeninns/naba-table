# [MEDIUM] Avatar upload calls a session-cookie mutation endpoint without server-side CSRF enforcement

**File:** [`hooks/useProfile.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/hooks/useProfile.ts#L152-L154) (lines 152, 153, 154)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

useUploadProfileAvatar posts attacker-controllable multipart form data to /api/profile/image. The related route authenticates only via the cookie-bound Supabase session and then uses the service-role client to write into the public profile-avatars bucket, but it never calls validateCsrfToken; src/proxy.ts only sets the CSRF cookie and does not validate it. fetchJson adds the x-csrf-token header for legitimate clients, but because the handler does not check it, a same-site attacker origin could trigger authenticated storage writes under the victim account.

## Recommendation

In src/app/api/profile/image/route.ts, call validateCsrfToken(req) before parsing formData and return 403 on failure. Keep the client header, and consider adding per-user rate limiting for avatar uploads.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
