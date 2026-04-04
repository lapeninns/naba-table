# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** Required env vars, external API keys/services, dependency quirks, platform-specific notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

- Next.js 16 with App Router and Turbopack
- pnpm 10.12.1, Node >=20.11.1
- Supabase for database (remote, cloud-hosted)
- `.env.local` contains all required env vars (already configured)
- Local env may run with `APP_ENV=staging` in this repository state.
- Local authenticated browser validation uses the `app.localhost` host mapping on port `3000`.
- For this mission, validate primarily at `http://app.localhost:3000/floor-plan`; use `http://localhost:3000/dev/ops-floor-plan` only as a fallback if auth/bootstrap becomes blocked.
