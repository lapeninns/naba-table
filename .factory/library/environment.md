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
- `APP_ENV=development` for local dev
