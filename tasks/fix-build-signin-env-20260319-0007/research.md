---
task: fix-build-signin-env
timestamp_utc: 2026-03-19T00:07:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Build and auth signin env failures

## Requirements

- Functional:
  - `build` must complete without noisy postbuild env parser failures.
  - Password sign-in must return a stable HTTP response when Supabase is unreachable.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing auth error privacy behavior.
  - Keep the fix narrow and avoid changing auth UX copy except where stability requires it.

## Existing Patterns & Reuse

- `src/app/api/auth/signin/route.ts` already centralizes password and magic-link sign-in.
- `server/auth/magic-link-email.ts` already contains a `normalizeHttpStatus` helper for external-provider failures.
- `src/app/sitemap.ts` and `src/app/robots.ts` already provide App Router metadata routes, so sitemap generation exists without `next-sitemap`.

## External Resources

- None required for the scoped code fix; existing repo patterns are sufficient.

## Constraints & Risks

- Do not modify secret values in `.env.local`.
- Supabase outage or DNS failure should not leak raw infra details to the client.
- Removing `next-sitemap` from the build path must not remove sitemap coverage because the app already exposes `/sitemap.xml` and `/robots.txt`.
- Local env had drift: `.env.local` referenced pre-staging ref `loxrwkeuxesctnrdpksy`, while the repo's linked staging project is `ndxmivcrehsacuerwxtm`.

## Open Questions (owner, due)

- Q: Should the repo fully remove `next-sitemap` dependency later?
  A: Not required for this task; owner: maintainers; due: next dependency cleanup.

## Recommended Direction (with rationale)

- Normalize non-HTTP auth provider errors in the sign-in route before building a `NextResponse`.
- Stop running `next-sitemap` during `postbuild` and rely on the canonical App Router sitemap/robots implementation already in `src/app`.
- Use the Supabase CLI against the stored access token to verify the actual project inventory, then realign local auth-facing env vars to the linked staging project instead of the DNS-dead pre-staging project.
