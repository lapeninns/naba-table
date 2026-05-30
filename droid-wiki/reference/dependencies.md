# Dependencies

Dependencies are declared in `package.json` and locked in `pnpm-lock.yaml`. The current stack is Next.js 16, React 19, TypeScript, Supabase JS/SSR, Radix/shadcn primitives, TanStack Query, Resend, Twilio-backed integration code, PostHog, Vite, Storybook, Vitest, Playwright, ESLint, and Prettier.

## Runtime groups

- Next/React: `next`, `react`, `react-dom`.
- Data/auth: `@supabase/supabase-js`, `@supabase/ssr`.
- UI: `@radix-ui/*`, `class-variance-authority`, `lucide-react`, `react-day-picker`, `sonner`.
- Data fetching/forms: `@tanstack/react-query`, `react-hook-form`, `zod`.
- Delivery/integrations: `resend`, Twilio env-backed integration code, PostHog/Plausible packages.

Review dependency freshness by group and run targeted QA packs; do not bulk-upgrade blindly.

Related: [Dependency freshness](../cleanup-opportunities/dependency-freshness.md).
