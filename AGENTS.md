# AGENTS.md

Stack and governance index for AI agents working in the Nabatable repository. Apply it together with the binding contracts in [micro-specs/README.md](micro-specs/README.md) and [micro-specs/GLOBAL_CONTEXT.md](micro-specs/GLOBAL_CONTEXT.md).

## The operating model — an AI software company

Treat this repo as a small **AI software company**. Work moves through two disciplines, and you may be wearing either hat:

- **Product (curator of intent).** A change starts as a _Micro-Spec_ — a small, declarative statement of the desired end state, blast radius, settled decisions, EARS requirements, and verification criteria. It says **what must be true when the work is done**, never line-by-line _how_. The authoring rules live in [Instructions_MicroSpecsCreation.md](Instructions_MicroSpecsCreation.md).
- **Engineering (disciplined TDD).** A Micro-Spec is implemented test-first, Red → Green → Refactor. The workflow is in [Instructions_tdd.md](Instructions_tdd.md) and is **binding**.

The binding governance contract is [micro-specs/README.md](micro-specs/README.md) — authoritative for spec metadata, lifecycle, risk_class, and verification gates. Product, stack, security, and verification baselines live in [micro-specs/GLOBAL_CONTEXT.md](micro-specs/GLOBAL_CONTEXT.md); apply both to all work and do not restate those rules in code. This [AGENTS.md](AGENTS.md) is the stack/governance index, and the design system is the shadcn/Luma primitive layer (`components/ui/**`, GLOBAL_CONTEXT §5, enforced by `pnpm guard:luma:strict`). A dedicated `DESIGN.md` and an as-built `docs/ARCHITECTURE.md` are planned follow-ups and do not yet exist — use `docs/sdlc/*` and the live code as the current map.

### How to execute a slice

1. **Narrow the work first.** The micro-specs folder is a backlog, not a fixed plan. Before implementing, inspect live code — much is already built. Reduce the task to _what is still missing_, and never widen a Micro-Spec's blast radius (the files/dirs it may touch) without approval.
2. **Red.** Write a failing test for each in-scope EARS requirement before production code. Tests live in `tests/micro-specs/` (Vitest, fast, mock the Supabase client) and `supabase/tests/` (SQL against real Postgres for invariants mocks cannot exercise — RLS, atomicity, tenant isolation).
3. **Green.** Write the _smallest_ code that passes. **Fake It** (hardcode) when the algorithm is unclear, then add a second test with a different input to **Triangulate** and force generalization. Use **Obvious Implementation** only for trivial, low-risk behavior. Don't optimize or generalize ahead of a test.
4. **Refactor** only under green; preserve behavior. Remove duplication by the **Rule of Three** (wait for the third occurrence) — premature abstraction is a defect here.
5. **Step size scales with uncertainty.** Baby steps (1–3 lines, run tests) for unclear problems; larger steps (4–7 lines) for obvious ones.

**Definition of Done:** all in-scope Micro-Specs pass; production code satisfies only the required behavior; fakes have been triangulated away; refactors changed structure not behavior; no untested behavior, speculative abstraction, or out-of-scope functionality added.

## Commands

```bash
pnpm dev                       # Next.js dev server (next dev --webpack)
pnpm build                     # production build (next build --webpack)
pnpm lint                      # ESLint over server/lib/scripts/src/app/app/src/components/features + shadcn guard
pnpm typecheck                 # tsc --noEmit (strict)
pnpm exec prettier --check .   # formatting check (use --write to fix)
pnpm validate:env              # validate env against the contract — run before any remote work
```

Tests — there is **no** `pnpm test` script; drive Vitest and Playwright directly:

```bash
pnpm exec vitest run                                            # full Vitest run (excludes tests/e2e)
pnpm exec vitest run tests/server/capacity/seatability.test.ts  # a single file
pnpm exec vitest run -t "seats a booking"                       # by test name
pnpm exec playwright test -c playwright.app.config.ts           # ops e2e; playwright.reserve.config.ts for guest reserve, playwright.config.ts for guest
```

Database — Supabase is **remote-only** and **staging-first**; all flows go through `scripts/db/safe-run.ts` (see GLOBAL_CONTEXT §4):

```bash
pnpm db:status            # supabase migration list
pnpm db:migrate           # apply migrations (re-applied each run, so migration SQL must be idempotent)
pnpm db:check-drift       # compare local migrations against the remote schema
pnpm db:push              # push migrations to the remote (supabase CLI)
```

Guards, security, and domain QA bundles (CI gates; see [docs/sdlc/verification.md](docs/sdlc/verification.md) for the change-type matrix):

```bash
pnpm guard:no-shadcn:strict                                  # single shadcn primitive layer
pnpm guard:luma:strict                                       # one Radix "Luma" theme
pnpm guard:micro-specs                                       # micro-spec metadata/lifecycle validator
pnpm security:regression && pnpm security:guard:service-role # security regression + service-role boundary
pnpm qa:public-booking                                       # domain QA (api + browser); also qa:ops-lifecycle, qa:capacity-tables, qa:guest-portal
```

## Architecture

Single Next.js 16 App Router app (React 19, TypeScript strict, Tailwind 4) serving **two shipped surfaces from one codebase**, split by host in [src/proxy.ts](src/proxy.ts). The proxy enforces the host split, `/app/*` transport, cross-host redirects, the CSRF cookie, and shared security headers — **any change to it is high risk** (GLOBAL_CONTEXT §2).

| Surface          | Host        | Where it lives                                                                                                                      |
| ---------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Ops**          | `app.` host | `src/app/app/**` — dashboard, bookings, seating, floor-plan, customers, email/SMS-delivery, settings; ops APIs `src/app/api/ops/**` |
| **Guest/public** | root host   | `src/app/(public)/**` (marketing + public booking flow) and `src/app/guest/**` (signed-link booking management)                     |

Shared domain code lives in `server/**` (bookings, capacity, emails, sms, Supabase access) and `lib/**` (clients, security, query, utils); the schema is `supabase/migrations/**`. Harness routes (`/dev/**`, `src/app/app/dev/**`, `__dev/**`) are supplemental and never count as shipped-route proof.

### The product's core: capacity & the booking lifecycle

Nabatable's centre of gravity is **capacity** — table inventory, zones, service periods, and turn times — and the **booking lifecycle**: request → confirm → seat → complete / cancel / no-show. A booking is placed against real capacity, may hold tables while it is being arranged, and is assigned to specific tables for a turn. Two invariants dominate the design:

- **A table is never double-booked.** Soft-hold acquisition and table assignment are **atomic, DB-time** operations (`acquire_soft_holds_atomic`, `create_booking_with_capacity_check`, `unassign_tables_atomic`), not read-modify-write in app code; holds expire server-side.
- **Lifecycle transitions are server-enforced and attributable.** State changes run through security-definer RPCs (`apply_booking_state_transition`, `apply_booking_state_transition_and_clear_assignments`) so capacity is released and customer aggregates stay consistent.

Every guest-facing booking change is an auditable, attributable, server-side action; booking and table state is always recoverable from the database, never reconstructed from the client. Ops/team auth is Supabase Auth (magic-link) + RLS tenant isolation; guest booking management is authorized by signed tokens.

### The mutation boundary (most important architectural rule)

Writes go through three layers — pick the **lowest sufficient** one (this elaborates GLOBAL_CONTEXT §4; all clients are constructed only in [server/supabase.ts](server/supabase.ts)):

1. **RLS-scoped reads / constrained writes** — cookie-carrying server clients (`getServerComponentSupabaseClient`, `getRouteHandlerSupabaseClient`, `getMiddlewareSupabaseClient`). RLS scopes the tenant for ops reads and ordinary writes.
2. **Security-definer RPC writes** — high-risk mutations run as Postgres functions that enforce ownership, rate limits, idempotency, and capacity/ledger invariants: `create_booking_with_capacity_check`, `acquire_soft_holds_atomic` / `release_soft_holds` / `cleanup_expired_soft_holds`, `apply_booking_state_transition`, `unassign_tables_atomic`, `record_booking_for_customer_profile_atomic`, `accept_restaurant_invite`, `create_restaurant_with_owner`. Capacity- and lifecycle-affecting writes **must** go through these, not direct table writes.
3. **Service-role server writes** — `getServiceSupabaseClient` / `getTenantServiceSupabaseClient` for trusted server-only code (webhook sync, dispatch jobs, cross-tenant readbacks). These **bypass RLS**, so callers must still enforce `restaurant_id`; service-role modules must never reach a client bundle (`import "server-only"`, guarded by `pnpm security:guard:service-role`).

Invariants a mock cannot exercise — RLS, atomicity, idempotency, tenant isolation, capacity consistency — must be proven against a real database (GLOBAL_CONTEXT §4, §6), never a mocked client.

### Data model & notifications

Restaurant/booking-oriented schema in `supabase/migrations/**` (Supabase is remote-only — the baseline lives in the remote project, so not every table appears as a local `CREATE TABLE`):

- **Tenancy & identity** — `restaurants`, `restaurant_memberships`, `restaurant_invites`, `customers`, `profiles`.
- **Capacity & seating** — `table_inventory`, `zones`, `table_adjacencies`, `booking_table_assignments`, `table_holds` + `table_hold_members` (soft holds), `restaurant_capacity_rules`, `restaurant_turn_bands`.
- **Bookings & scheduling** — `bookings`, `booking_occasions`, `waiting_list`, `restaurant_operating_hours`, `restaurant_service_periods`.
- **Notifications** — `email_delivery_log`, `sms_delivery_log`, `email_dispatch_intents`, `booking_confirmation_notification_claims`: outbound email (Resend) and SMS (Twilio) with delivery tracking. `audit_logs` covers sensitive ops mutations.
- **Restaurant profile & menus** — the `restaurant_menu_*`, `restaurant_external_profile*`, and `dual_sync_*` families back menu management and Google Business Profile sync.

PostHog mirrors product analytics; guest PII (name, email, E.164 phone) stays redacted in logs and analytics (GLOBAL_CONTEXT §4). Provider webhooks (`/api/webhook/resend`, `/api/webhook/twilio/sms-status`) are unauthenticated entry points that must verify signatures.

## Conventions that bite if missed

- **Next.js 16 differs from your training data.** APIs, conventions, and file structure have changed. Before writing routes, Server Actions, Route Handlers, auth, or data mutations, verify behavior against the installed Next.js 16 (App Router) — don't assume older-version APIs — and heed deprecation notices.
- **Design system = one Radix "Luma" shadcn theme.** shadcn/ui-first is mandatory; the single primitive layer is `components/ui/**` (plus the `src/components/ui/**` export), shared by ops and guest/public. Don't introduce native HTML primitive systems, parallel component libraries, or one-off base components. Enforced by `pnpm guard:no-shadcn:strict` and `pnpm guard:luma:strict` (GLOBAL_CONTEXT §5).
- **No legacy `nabaperks` naming.** The product is Nabatable (restaurant bookings/ops), not the retired loyalty/stamp app — keep new code, copy, and identifiers free of loyalty/stamp/QR-card naming.
- **UI changes require browser verification on a real shipped route** at mobile-first widths (GLOBAL_CONTEXT §5–6). Harness routes (`/dev/**`, `src/app/app/dev/**`, `__dev/**`) are supplements only and never count as proof.
