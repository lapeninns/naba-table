---
task: auth-email-fallback
timestamp_utc: 2025-11-28T07:49:53Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Auth email fallback is sending multiple templates

## Requirements (current understanding)

- Symptom: fallback email template appears to send both "Confirm signup" and "Magic link" messages.
- Goal (needs confirmation): ensure only the intended template is sent for each flow, or clarify why both are firing.

## Existing Patterns & Reuse

- Sign-in API (`src/app/api/auth/signin/route.ts`) calls `supabase.auth.signInWithOtp` for the magic-link flow; this triggers Supabases built-in email handling.
- Self-serve signup is disabled (`src/app/(public)/auth/signup/page.tsx` shows invite-only copy); new accounts are typically created via team invites (`src/app/api/team/invitations/[token]/accept/route.ts`) which set `email_confirm: true`, bypassing Supabase confirmation emails.
- Magic-link test script (`test-magic-link.mjs`) also uses `signInWithOtp` with `emailRedirectTo` pointing at `/api/auth/callback`.

## External Resources

- Supabase email templates guide (lists confirm signup, invite, magic link, change email, reset password, reauthentication).
- Passwordless magic-link guide: `signInWithOtp` sends a magic link by default and auto-signs up new users unless `shouldCreateUser` is set to false.
- API reference: `signInWithOtp` will sign up the user if they don't exist; `shouldCreateUser`/`createUser` can disable that.

## Constraints & Risks

- Must follow root AGENTS rules: task artifacts required; no coding before plan; Supabase migrations remote-only; accessibility and evidence for UI changes (not expected here but keep in mind).
- Email flows depend on Supabase project settings (confirmation on/off, template configuration); changes may affect production users.
- Risk of spamming users if we test against live auth with real addresses.

## Open Questions (owner: pending)

- When the fallback template fires, which user action triggers each email (new account vs returning login)?
- Are email confirmations enabled in the Supabase project? (Setting affects whether confirm email is sent.)
- Do we want to disable confirmations for magic-link-only auth, or customize distinct templates instead of fallback?
- Do we have staging credentials/mailbox to reproduce without impacting prod users?

## Recommended Direction (draft)

- Confirm Supabase auth settings (email confirmation toggle, templates configured) in the target project.
- Reproduce flows in staging: (a) brand-new email via magic-link sign-in, (b) existing confirmed email; capture which template is sent in each case.
- If the issue is expectation mismatch: document that Supabase intentionally sends Confirm Signup for new/unconfirmed users even when using `signInWithOtp`.
- If behavior is undesired: consider turning off email confirmation (if acceptable) or switching to passwordless sign-in with `shouldCreateUser: false` plus explicit onboarding to avoid signup emails.
