---
task: auth-email-templates
timestamp_utc: 2025-11-28T08:06:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create `docs/auth-email-templates.md` with global guidance.
- [x] Add a quick reference table for Supabase template variables.

## Core

- [x] Draft personalized HTML + plain-text templates for Confirm signup.
- [x] Draft personalized HTML + plain-text templates for Invite user.
- [x] Draft personalized HTML + plain-text templates for Magic link (passwordless).
- [x] Draft personalized HTML + plain-text templates for Change email address (current & new).
- [x] Draft personalized HTML + plain-text templates for Reset password.
- [x] Draft personalized HTML + plain-text templates for Reauthentication.
- [x] Add safety notes: expiry timing, ignore-if-not-you, support contact, device/location hints where possible.
- [x] Ensure CTA/button text is distinct per flow to avoid confusion.

## QA / Verification

- [x] Self-review placeholders against Supabase docs (`ConfirmationURL`, `SiteURL`, change-email tokens, reauth URL).
- [x] Check tone, grammar, and consistency across HTML/plain text.
- [ ] Confirm support contact placeholder and branding are consistent.

## Notes

- Assumptions: brand voice is Nab a Table; support contact will be updated if different.
- Deviations: No live Supabase dashboard updates; documentation only.
