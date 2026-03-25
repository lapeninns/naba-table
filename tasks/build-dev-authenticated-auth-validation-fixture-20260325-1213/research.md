---
task: build-dev-authenticated-auth-validation-fixture
timestamp_utc: 2026-03-25T12:13:04Z
owner: github:@factory-droid
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: build-dev-authenticated-auth-validation-fixture

## Requirements

- Functional:
  - Add a dev-only authenticated auth-validation harness that lets validators safely prove authenticated redirect behavior for `/`, `/auth/signin`, and `/auth`.
  - Cover guest-authenticated home redirect to `/guest/dashboard`.
  - Cover sign-in return-to-intent behavior for safe guest/public and app-owned intents.
  - Cover authenticated `/auth` canonicalization for guest users and owner/admin users.
  - Keep the harness isolated from shared local auth state.
- Non-functional:
  - Dev-only route/harness, unreachable outside local development.
  - Follow existing guest routing/auth helpers instead of duplicating policy.
  - Keep browser validation deterministic and compatible with `PLAYWRIGHT_DEV_HARNESS=1`.

## Existing Patterns & Reuse

- Existing auth behavior lives in:
  - `src/app/(public)/page.tsx`
  - `src/app/(public)/auth/(role-selection)/page.tsx`
  - `src/app/(public)/auth/signin/page.tsx`
  - `src/app/app/auth/signin/page.tsx`
  - `lib/auth/redirects.ts`
  - `src/proxy.ts`
- Existing dev-only harness guard:
  - `src/app/(public)/dev/_shared/enforceDevOnly.ts`
- Existing Playwright live-surface auth coverage:
  - `tests/e2e/guest-auth-pages.spec.ts`
- Existing isolated fixture conventions:
  - query-driven or dev-only harness routes under `src/app/(public)/dev/**`

## External Resources

- None needed; repo patterns and mission library are sufficient.

## Constraints & Risks

- Must not mutate shared Supabase/local auth cookies or rely on real sign-in completion.
- Directly mocking all auth internals would risk diverging from actual redirect logic.
- Best approach is to reuse route decision rules while injecting an explicit dev-only authenticated fixture state.

## Open Questions (owner, due)

- Q: Should the fixture use browser cookies or query params to choose guest vs owner/authenticated state?
  A: Query-driven server harness state is safest because it avoids shared cookie mutation while remaining deterministic.

## Recommended Direction (with rationale)

- Add a dev-only auth validation harness route that computes expected redirect destinations using the same redirect sanitization and role logic as the real pages, but with explicit fixture roles passed in query params.
- Extend the Playwright auth spec to validate the fixture flows instead of requiring a real authenticated session.
- Document the fixture in `.factory/library/user-testing.md` because future validators depend on it.
