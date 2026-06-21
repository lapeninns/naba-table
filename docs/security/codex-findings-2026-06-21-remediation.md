# Codex Security findings — 2026-06-21 remediation pass

Source: `codex-security-findings-2026-06-21T10-15-27.343Z.csv` (99 findings, repo `amanshresthaa/nabatable`).
Full triage + evidence ledger: `.omo/evidence/security-findings-verify-fix/` (not committed to product code).

> This doc records verified status only. **Scanner alerts are NOT closed here** — closure requires the
> gated remote apply + scanner rerun listed below.

## Outcome (all 99 accounted — see `final-scanner-closure.md`)

- **66 not_actionable** — vulnerable artifact removed/refactored/guarded at HEAD with cited counterevidence.
- **11 fixed (local, TDD Red→Green)** — disclosure/cache/upload/UI: triage-039, 041, 042, 059, 063, 070, 079, 091, 093, 096, 099.
- **10 RPC execute-hardened** — `supabase/migrations/20260621120000_harden_assignment_rpc_privileges.sql`
  (REVOKE PUBLIC/anon/authenticated + GRANT service_role for assign/booking-lifecycle SECURITY DEFINER RPCs):
  triage-003, 014, 015, 016, 019, 022, 025, 026, 029, 061. **Remote apply + `pnpm db:check-drift` = GATED.**
- **4 RLS drafts (gated)** — triage-021, 034, 068, 078 → `.omo/evidence/.../proposed-migrations/GATED-rls-hardening-DRAFT.sql`.
- **5 secrets (gated rotation + history scrub)** — triage-001, 002, 006, 020, 044 → `.omo/evidence/.../05-secret-rotation-history-support.md`.
- **1 remote-introspection gated** — triage-054 (`confirm_hold_assignment_tx` body is remote-only).
- **2 deferred with spec** — triage-058 (fail-open behavior change, needs sign-off), triage-074 (applied-migration conname scoping).

## New permanent guards

- `tests/server/capacity/assignment-rpc-privileges-security.test.ts` — asserts the RPC hardening migration
  REVOKEs/grants correctly (wired into `pnpm security:regression`).
- Plus per-fix regression tests (occasion-cache, email-from, csv/list projection, svg-upload, localStorage,
  busy-map end_at, legacy availability null-times, wizard-context-optional).

## Gated external operations (require explicit approval)

1. Apply the RPC hardening migration + RLS drafts to remote Supabase (staging-first); confirm ACLs via `db:check-drift`.
2. Rotate exposed credentials + scrub git history (see support packet).
3. Remote policy/grant introspection for triage-021/034/054/068/078.
4. Close Codex/GitHub scanner alerts after scanner rerun.
