---
task: auth-security-assessment
timestamp_utc: 2025-11-25T20:00:00Z
summary: Notes captured while reviewing authentication, session, and state management flows.
---

## Reviewed areas

- Supabase client setup for browser, server components, route handlers, and service role usage.
- Next.js auth callback handler and sign-in form (password and magic-link flows).
- Session/state hooks and contexts (`useSupabaseSession`, ops session context) plus query persistence and analytics localStorage usage.
- Environment configuration for public vs server-side credentials.
- Presence of rate limiting, MFA, CSRF protections, and logging patterns in auth-related routes.
