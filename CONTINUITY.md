# Continuity Ledger

Last updated: 2026-04-05T15:55:00Z

## Goal (incl. success criteria)

- Fix the reservation wizard so restaurant-scoped flows stop showing false draft-expiry resets.
- Success: scoped routes only restore matching scoped drafts.
- Success: generic routes can still restore the legacy draft when no restaurant slug is known.

## Constraints/Assumptions

- Follow root and `reserve/AGENTS.md` rules, including task artifacts and focused implementation.
- This flow uses browser storage (`localStorage` and `sessionStorage`), not cookies.
- Treat this as a regression fix and document the verification-first investigation path.

## Key decisions

- Target the canonical storage loader in `useWizardDraftStorage.ts` instead of adding UI-level guards.
- Keep the fix narrow: stop wrong-key fallback for scoped flows before considering broader persistence redesign.

## State

- Phase 4 verification complete for the code change; browser proof attempted but partially blocked by the local reserve slug route error boundary.

## Done

- Traced the alert source and confirmed it comes from `stored.expired`.
- Confirmed the reserve app mixes slugged and unscoped wizard routes.
- Created task artifacts under `tasks/fix-wizard-draft-expiry-20260405-1550/`.
- Patched `loadWizardDraft` so slugged flows ignore unscoped legacy drafts.
- Added regression coverage in `tests/reserve/wizardDraftStorage.test.ts`.
- Ran targeted Vitest coverage and full `pnpm typecheck`.

## Now

- Finalize the task summary and share the verification caveat from the blocked browser route.

## Next

- If needed, investigate the local reserve slug-route error boundary separately so browser proof can be completed on the real wizard surface.

## Open questions (UNCONFIRMED if needed)

- Browser clock skew may still cause true early expiry on misconfigured devices. (UNCONFIRMED frequency)
- Whether the reserve local dev harness route error is an existing environment issue or a separate product bug. (UNCONFIRMED)

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/nabatableLP/reserve/features/reservations/wizard/hooks/useWizardDraftStorage.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/reserve/features/reservations/wizard/hooks/useReservationWizard.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/reserve/app/routes.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/reserve/pages/WizardPage.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tests/reserve/wizardDraftStorage.test.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/fix-wizard-draft-expiry-20260405-1550/
