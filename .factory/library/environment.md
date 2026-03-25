# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** Required env vars, external API keys/services, dependency quirks, platform-specific notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

- Next.js 16 with App Router and Turbopack
- pnpm 10.12.1, Node >=20.11.1
- Supabase/Auth-backed environment is reused from the developer machine; no schema work is in scope
- Mission execution happens in the isolated worktree:
  - `/Users/amankumarshrestha/LapenInns Project/nabatableLP-guest-design-system-20260325-0745`
- The original checkout remains available at:
  - `/Users/amankumarshrestha/LapenInns Project/nabatableLP`
- `.env.local` is not tracked in git; `.factory/init.sh` symlinks the original checkout’s `.env.local` into the worktree when needed
- Existing local app server runs on port `3000`
- Off-limits ports/processes:
  - `3001` (another local project)
  - `3100` (another local service)
  - `5000` and `7000` (macOS system services)
