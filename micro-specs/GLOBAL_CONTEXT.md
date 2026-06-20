# Global Context for AI Agents

This file is the **single source of product, stack, security, and verification baselines**
for every Micro-Spec. Per `Instructions_MircroSpecsCreation.md`, individual specs **must not
restate** anything here — they reference it and add only the business logic specific to the
change. If a rule is broad and reusable, it belongs here (or in `AGENTS.md` / `docs/sdlc/*`),
not in a spec.

It is a governance document, not a spec, so it carries no metadata block and is exempt from
the validator (`scripts/check-micro-specs.mjs`).

> This describes **Nabatable** as it actually ships: a restaurant booking and operations
> platform (not a loyalty/stamp product).

---

## 1. Product

Nabatable is a **restaurant booking and operations platform**. Restaurants run their service
from an ops console; guests discover availability and self-manage bookings from a public site.
The product's centre of gravity is **capacity** (tables, zones, service periods, turn times)
and the **booking lifecycle** (request → confirm → seat → complete / cancel / no-show), plus
the outbound **notifications** (email + SMS) that keep guests informed.

## 2. Surfaces and host split

Two real shipped surfaces, one codebase:

| Surface          | Host      | Routes                                          |
| ---------------- | --------- | ----------------------------------------------- |
| **Ops**          | app host  | `src/app/app/**`, ops APIs `src/app/api/ops/**` |
| **Guest/public** | root host | `src/app/(public)/**`, `src/app/guest/**`       |

`src/proxy.ts` enforces the host split, cross-host redirects, `/app/*` transport, CSRF cookie,
and shared security headers. **Any change to `src/proxy.ts` is high risk.** Harness routes
(`/dev/**`, `src/app/app/dev/**`, `__dev/**`) are supplemental only and never count as
shipped-route proof.

## 3. Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 4 · Radix-based shadcn/ui
("Luma" theme) · TanStack React Query 5 · Zustand · Supabase (`@supabase/supabase-js` +
`@supabase/ssr`, Postgres + Auth + RLS) · Vitest 4 · Playwright 1.58 · PostHog (analytics) ·
Resend (email) · Twilio (SMS) · Luxon (timezone) · Zod + React Hook Form. No Stripe / billing
SDK is present in the repo today.

## 4. Security and data invariants

- **Supabase is remote-only. Staging-first is mandatory** unless a spec explicitly states
  otherwise. There is no local-Supabase workflow. Record `APP_ENV`, `DB_TARGET_ENV`, and the
  target class (read-only / write / migration) for any data-path work, and run
  `pnpm validate:env` before remote work.
- **Three write layers** (pick the lowest sufficient one): RLS-scoped server-client reads/
  constrained writes; **security-definer RPCs** for high-risk mutations (ownership, rate
  limits, idempotency, ledger/capacity invariants — e.g. atomic table assignment, soft-hold
  expiry); **service-role** server-only writes that must never reach a client bundle
  (`import "server-only"`; guarded by `pnpm security:guard:service-role`).
- **Auth/session**: Supabase Auth (magic-link) for ops/team with RLS tenant isolation; signed
  tokens for guest booking management. Auth, session, permission, and tenant-boundary changes
  are high risk and need happy-path + negative-path + boundary verification.
- **Migrations** live in `supabase/migrations/` and are re-applied on each run, so **all
  migration SQL must be idempotent**. Invariants a mock cannot enforce (RLS, atomicity,
  idempotency, tenant isolation, ledger/capacity consistency) must be proven against a real
  database, not a mocked client.
- **Customer PII** (guest name, email, E.164 phone) must stay redacted in logs and analytics
  (`lib/logger.ts`, `lib/sms/phone-redaction.ts`). Never print secrets or PII into logs,
  task artifacts, or test output.
- **Webhooks** (`/api/webhook/resend`, `/api/webhook/twilio/sms-status`) are unauthenticated
  entry points and must verify provider signatures.

## 5. UI system

shadcn/ui-first is mandatory. The single primitive layer is `components/ui/**` (treated as
cross-surface, high-risk) plus the small `src/components/ui/**` export; ops and guest/public
share **one Radix "Luma" theme**. Do not introduce native HTML primitive systems, parallel
component libraries, or one-off base components in app code. Guards:
`pnpm guard:no-shadcn:strict` and `pnpm guard:luma:strict`. UI changes require browser
verification on **real shipped routes** at mobile-first widths — never harness-only.

## 6. Verification baselines

Use commands that actually exist (see `docs/sdlc/verification.md` for the change-type matrix):

- `pnpm lint` — eslint over `server lib scripts src/app/app src/components/features` **plus**
  the shadcn guard. It does **not** cover all of `src/**`, `components/**`, or markdown. For
  changed JS/TS outside that set, run targeted `pnpm exec eslint --max-warnings=0 <files>` or
  record the coverage gap.
- `pnpm typecheck` (`tsc --noEmit`, strict) · `pnpm exec vitest run …` (excludes `tests/e2e`)
  · `pnpm exec playwright test …` (mobile-first; `.app` / `.reserve` configs) ·
  `pnpm exec prettier --check …` · `pnpm validate:env`.
- Domain QA bundles: the `qa:*` family (e.g. `qa:capacity-tables`, `qa:ops-lifecycle`,
  `qa:public-booking`) and `pnpm security:regression`.

Tests split by tier: fast Vitest under `tests/**` (mock the Supabase client for behaviour and
branching); real-database SQL for invariants a mock cannot exercise. A passing mocked test is
**not** evidence that an RLS / atomicity / tenant-isolation invariant holds.

## 7. Process baselines

- **Medium/high-risk work uses a task folder** `tasks/<slug>-YYYYMMDD-HHMM/` per
  `docs/sdlc/task-harness.md`. Classify risk with `docs/sdlc/risk-tier-workflow.md`.
- **Narrow first.** The spec corpus is a backlog, not proof that work is unstarted — inspect
  live code and implement only what is missing (`micro-specs/README.md` → Working Rule).
- **Do not claim verification that was not performed**, and never turn a harness pass into
  shipped-route proof.
