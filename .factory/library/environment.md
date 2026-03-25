# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** Required env vars, external API keys/services, dependency quirks, platform-specific notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

- Next.js 16 with App Router and Turbopack
- pnpm 10.12.1, Node >=20.11.1
- Supabase for database (remote, cloud-hosted)
- Resend for email delivery
- `.env.local` contains all required env vars (already configured)
- Local env may run with `APP_ENV=staging` in this repository state.
- When `APP_ENV=staging`, `/dev/ops-email-delivery` may be unavailable or shell-only; use authenticated `http://app.localhost:3000/email-delivery` for validation.
