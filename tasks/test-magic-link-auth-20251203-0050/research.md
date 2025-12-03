---
task: test-magic-link-auth
timestamp_utc: 2025-12-03T00:50:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Magic Link Authentication Validation

## Requirements

- Functional:
  - Confirm users can request a magic link via auth endpoints (`/auth/signin` UI + `/api/auth/signin` route) and complete the callback to land on the dashboard while logged in.
  - Ensure the generated callback/redirect URLs honor `NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com` so cookies scope to `.nabatable.com`.
- Non-functional:
  - No unexpected user creation or signup bypass during tests.
  - Avoid leaking secrets; keep test emails limited to known team addresses.
  - Maintain existing a11y/perf baselines (no code changes expected here).

## Existing Patterns & Reuse

- Recent fix documented in `MAGIC_LINK_FIX.md` outlining the missing `NEXT_PUBLIC_ROOT_DOMAIN` root cause and desired log signals.
- Auth routes already in place: `src/app/api/auth/signin/route.ts` and `src/app/api/auth/callback/route.ts` with enhanced logging for domain/redirect validation.
- Client UI forms in `components/auth/SignInForm.tsx` and `components/auth/OpsSignInForm.tsx` handle magic link submission and cooldown states.
- CLI helper `test-magic-link.mjs` sends a Supabase OTP email using current env vars; reuse for send verification.
- Automated coverage exists in `src/app/api/auth/signin/route.test.ts` and `src/app/api/auth/signup/route.test.ts` for magic link paths.

## External Resources

- None yet; relying on in-repo docs/tests. (Use Supabase dashboard only if log inspection is required.)

## Constraints & Risks

- Using production Supabase/an email will deliver a real message; restrict to a controlled test mailbox (e.g., support/test alias defined in env) to avoid spamming customers.
- If `NEXT_PUBLIC_ROOT_DOMAIN` is unset locally, callbacks may default to `localhost`, invalidating the test; must verify env before running.
- Signup-disabled configurations could block magic link generation for new addresses; prefer an existing account email.

## Open Questions (owner, due)

- Which mailbox is safe for production magic-link sends? → Assume `NEXT_PUBLIC_SUPPORT_EMAIL` or provided test alias (documented once chosen). (owner: assistant, due: before execution)
- Is Supabase log access available locally for verifying domain values? If not, rely on response/log output from the existing logging. (owner: assistant, due: before verification write-up)

## Recommended Direction (with rationale)

- Use existing automated tests to sanity-check route logic without hitting external services.
- Run the `test-magic-link.mjs` helper against the configured env to ensure Supabase accepts the request and reports success with the correct redirect base.
- If feasible, validate callback/session by completing the link from the inbox; otherwise, capture Supabase response + server logs as evidence and note limitation in verification.
