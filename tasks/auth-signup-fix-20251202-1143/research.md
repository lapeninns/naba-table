---
task: auth-signup-fix
timestamp_utc: 2025-12-02T11:43:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Auth Signup Flow Stability

## Requirements

- Functional: Ensure auth/signup flow works end-to-end (form submission, account creation, email handling, redirect/confirmation); identify and fix existing issues uncovered by tests or manual QA.
- Non-functional (a11y, perf, security, privacy, i18n): A11y-compliant form (labels, focus, keyboard); avoid leaking secrets; performant client/server interactions; validation at boundaries.

## Existing Patterns & Reuse

- `/auth/signup` page uses server component guard `ensureCsrfCookie()` and renders `OwnerSignupForm` (Shadcn card, RHF + zod).
- API: `src/app/api/auth/signup/route.ts` handles password & magic-link modes, rate limits, CSRF, Supabase `signUp`/`signInWithOtp`, redirect sanitization, cookie copy for session.
- Related auth patterns: sign-in form/route share zod validation + rate limiting; callback route handles Supabase code exchange.
- Reuse: follow status handling and session-refresh patterns from `SignInForm` where relevant; keep rate-limit headers and CSRF checks consistent with existing routes.

## External Resources

- MCP Context7/DeepWiki unavailable in this environment; will rely on in-repo docs and code. Evidence of manual investigation will be captured in `artifacts/`.

## Constraints & Risks

- Auth/security regressions risk user signups; need to avoid breaking other auth flows (login, magic link, password reset).
- Supabase remote-only rule if DB interactions involved.
- CI requires task artifacts and Conventional Commit.
- Many unrelated vitest failures across reservations/ops modules; keep scope constrained to auth/signup. Document out-of-scope failures.

## Open Questions (owner, due)

- What current failing tests or issues exist in signup flow? (owner: assistant, due: before implementation)
- Are there environment configs/secrets required for signup tests (email provider, Supabase keys)? (owner: assistant, due: before running tests)
- How should callback route behave when Supabase exchange returns no `data` (mocked in tests)? (owner: assistant, due: during fix)

## Recommended Direction (with rationale)

- Run existing auth/signup tests (unit/E2E) to surface failures; reproduce manually if needed.
- Trace through signup route/components to align fixes with existing patterns (shadcn, hooks/services).
- Prioritize boundary validation and error handling; keep changes minimal and focused on signup path.
- Fix auth callback robustness (null-safe access, optional getUser) and align log copy to expected strings to unblock signup magic-link flow tests.
