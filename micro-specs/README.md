# Micro-Spec Governance Contract

This is the **binding AI governance contract** for Nabatable. It is authoritative for
Micro-Spec **metadata**, **source hierarchy**, **lifecycle status transitions**,
**risk_class**, **blast radius**, and **verification gates**. `Instructions_MircroSpecsCreation.md`
(the WHAT) and `Instructions_tdd.md` (the HOW) both defer to this file; where they describe a
process, this file defines the enforceable rules behind it.

A Micro-Spec is **implementation-ready** only when it conforms to everything below. Conformance
is **mechanically enforced** by `scripts/check-micro-specs.mjs` (`pnpm guard:micro-specs`) and
its Vitest gate `tests/micro-specs/check-micro-specs.test.ts`.

---

## 1. What a Micro-Spec is (and is not)

A Micro-Spec is a small, declarative statement of a desired end state: its goal, blast radius,
settled decisions, EARS requirements, and verification criteria. It owns the **WHAT**; it never
dictates line-by-line **HOW**. It targets a single feature, workflow, or state machine
completable in ~1–3 days. Authoring rules: `Instructions_MircroSpecsCreation.md`.

This directory is a **backlog, not a fixed plan**. A spec describing an end state is not proof
the work is unstarted (see the Working Rule, §7).

## 2. Source hierarchy (precedence)

When guidance appears to conflict, the **more specific, lower-level** source wins for its own
scope, but none may contradict a higher invariant (security, host split, remote-only Supabase):

1. `AGENTS.md` — global non-negotiables and stack/governance index.
2. `micro-specs/GLOBAL_CONTEXT.md` — product, stack, security, verification baselines.
3. `docs/sdlc/*` — execution loop, risk tiers, task harness, verification contract.
4. **This contract** (`micro-specs/README.md`) — spec metadata, lifecycle, risk_class, gates.
5. The individual Micro-Spec — business logic for one change only.

A spec **must not restate** rules owned by levels 1–3. Restating them is a defect (drift risk).

## 3. Directory layout and `spec_id`

Specs live in numbered **area** folders; top-level `*.md` here (`README.md`, `GLOBAL_CONTEXT.md`)
are governance docs, not specs, and are exempt from validation.

| Area folder         | `<area>` token  | Scope                                                              |
| ------------------- | --------------- | ------------------------------------------------------------------ |
| `00-foundation/`    | `foundation`    | Governance, tooling, cross-cutting process                         |
| `01-platform/`      | `platform`      | Proxy/host split, auth, session                                    |
| `02-ops/`           | `ops`           | Ops surface (bookings, capacity, customers, settings)              |
| `03-guest/`         | `guest`         | Guest/public surface (public booking, guest portal, reserve)       |
| `04-data/`          | `data`          | Migrations, RLS, security-definer RPCs, ledger/capacity invariants |
| `05-integrations/`  | `integrations`  | Webhooks, GBP dual-sync, email/SMS providers                       |
| `06-observability/` | `observability` | Analytics, PII redaction, logging                                  |

Filenames are `NN-slug.md` (ordered within an area). `spec_id` is `MS-<area>-<slug>`, all
lowercase after the `MS-` prefix, e.g. `MS-ops-booking-cancel`, `MS-foundation-micro-spec-governance`.

## 4. Micro-Spec Metadata Schema (required)

Every spec begins with this YAML frontmatter block. All keys are required; `approved_exceptions`
may be `[]` but must be present.

```yaml
spec_id: MS-<area>-<slug>
status: draft | active | implemented | verified | superseded
risk_class: docs-tooling | ui-only | product-analytics | customer-pii | auth-session | billing | webhooks | rls-rpc-ledger | migrations
owner: <person-or-agent>
last_reviewed: YYYY-MM-DD
allowed_blast_radius:
  - <repo-local path or glob>
implementation_surfaces:
  - <repo-local path or glob>
related_docs:
  - <repo-local path>
related_tests:
  - <repo-local path>
verification_gates:
  - pnpm lint
approved_exceptions: []
```

Below the block, use the six section headings from `Instructions_MircroSpecsCreation.md` in
order: **1. Exact Goal and User-Visible Outcomes**, **2. Blast Radius: In Scope and Out of
Scope**, **3. Strict Constraints and Assumptions**, **4. Decisions Already Made**, **5.
Behavioral Requirements Using EARS Notation**, **6. Verification Criteria and Task Breakdown**. The worked example to copy is
[`00-foundation/01-micro-spec-governance.md`](00-foundation/01-micro-spec-governance.md).

## 5. Lifecycle status transitions

```
draft ──▶ active ──▶ implemented ──▶ verified
  │         │              │              │
  └─────────┴──────────────┴──────────────┴────▶ superseded
```

- **draft** — authored, not yet approved as an implementation input.
- **active** — approved; the default input for TDD. Only `active` specs are picked up by
  default (`Instructions_tdd.md` §0). `draft` / `superseded` need a refreshed `active` spec or
  an `approved_exceptions` entry before tests or production code are written.
- **implemented** — production code satisfies the requirements; tests exist.
- **verified** — tests pass and the verification gates are green. A `verified` (or
  `implemented`) spec **must** cite real, on-disk `related_tests` — this is the enforced
  encoding of the TDD Definition of Done.
- **superseded** — replaced by a newer spec; retained for history. Transitions only move
  forward (or to `superseded`); never silently downgrade a status.

## 6. risk_class → required verification gates

`risk_class` sets the **minimum** verification a spec's gates must include; escalate when the
real blast radius is larger (`docs/sdlc/risk-tier-workflow.md`). Gates must name real commands
(a `package.json` script or a known `pnpm exec` tool) or the validator rejects them.

| risk_class          | Nabatable surface (evidence)                             | Minimum gates                                                                  |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `docs-tooling`      | governance, scripts, docs                                | `pnpm exec prettier --check`; the relevant tooling test                        |
| `ui-only`           | `components/ui/**`, ops/guest components, Luma theme     | `pnpm guard:no-shadcn:strict`; `pnpm guard:luma:strict`; real-route browser QA |
| `product-analytics` | `lib/analytics`, `lib/posthog/*`, `product_events`       | `pnpm exec vitest run` analytics/redaction tests                               |
| `customer-pii`      | guest name/email/phone; log + SMS redaction              | `pnpm exec vitest run` redaction tests; negative path                          |
| `auth-session`      | `server/auth/*`, proxy session, CSRF, guest tokens       | `pnpm security:regression`; happy + negative + boundary                        |
| `billing`           | (no Stripe in repo today — reserved)                     | escalate; define gates when a billing surface lands                            |
| `webhooks`          | `/api/webhook/resend`, `/api/webhook/twilio/*`           | `pnpm exec vitest run` webhook/signature tests                                 |
| `rls-rpc-ledger`    | security-definer RPCs, capacity/soft-hold atomicity, RLS | real-database SQL tests + `pnpm exec vitest run`; mocked tests are not enough  |
| `migrations`        | `supabase/migrations/**` (idempotent)                    | migration apply/drift check on staging; `pnpm validate:env`                    |

## 7. Working Rule, blast radius, and stop conditions

- **Working Rule (narrow first).** Before writing tests, inspect live code and reduce the task
  to the in-scope requirements **not already satisfied**. Do not re-implement existing behavior.
- **Blast radius is a contract.** `allowed_blast_radius` lists every path/glob the
  implementation may create or modify. Editing outside it — or adding a dependency, changing a
  schema, or making a product decision the spec did not settle — requires **approval first**,
  not silent widening (`Instructions_tdd.md` §0, §4). `implementation_surfaces` names where the
  code is expected to live (may include not-yet-created paths); `related_docs` must already
  exist on disk.
- **Stop and surface** when an in-scope requirement is ambiguous, contradicts live code, or
  cannot be met inside the blast radius. Record the assumption you would otherwise have made.

## 8. Mechanical enforcement

`scripts/check-micro-specs.mjs` validates every spec under an area folder and fails on: a
missing frontmatter block or required key; an out-of-enum `status` or `risk_class`; a
malformed `spec_id`; an unreal `last_reviewed` date; an empty required scope list; a
`related_docs` path that does not resolve; a `related_tests` path that does not resolve for an
`implemented`/`verified` spec; or a `verification_gate` that names no real command.

```bash
pnpm guard:micro-specs                                          # validate the whole corpus
pnpm exec vitest run tests/micro-specs/check-micro-specs.test.ts # the validator's own gate
```

## 9. Authoring → implementation flow

1. **Author** the spec per `Instructions_MircroSpecsCreation.md`; set `status: draft`.
2. **Approve** → `status: active`; `pnpm guard:micro-specs` must pass.
3. **Narrow** (Working Rule), then **implement test-first** per `Instructions_tdd.md`
   (Red → Green → Refactor); tests in `tests/micro-specs/` (mocked) and `supabase/tests/`
   (real DB) per tier.
4. Advance `status` to `implemented`, then `verified` once gates are green and
   `related_tests` resolve. Roles and handoff packets: `.agents/*` and `docs/sdlc/subagents.md`.
