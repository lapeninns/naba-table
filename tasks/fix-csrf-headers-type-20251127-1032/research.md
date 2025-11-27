---
task: fix-csrf-headers-type
timestamp_utc: 2025-11-27T10:32:28Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Fix CSRF headers type error

## Requirements

- Functional: Resolve the TypeScript build error in `server/security/csrf.ts` so `pnpm run build` succeeds on Next.js 16.0.3. Keep CSRF cookie security logic unchanged (still prefer secure cookies when forwarded protocol is https or when not in development).
- Functional: Resolve the TypeScript error in `server/security/rate-limit.ts` where `parseBooleanEnv` is referenced before declaration, so build completes.
- Non-functional: Maintain security posture (no weaker cookie flags); minimal, targeted change; follow existing patterns.

## Existing Patterns & Reuse

- The CSRF helpers already use `cookies()` with `await` but call `headers()` synchronously. In Next.js 16, `headers()` now returns a `Promise<ReadonlyHeaders>`, so we should align with that pattern by awaiting once and reusing the returned headers object.
- The rate-limit module defines `parseBooleanEnv` after it is first used; reordering the helper above its first reference follows standard top-down declarations used elsewhere in the file (e.g., constants before functions).
- No other files in `server/` call `headers()`, so the change is isolated to `server/security/csrf.ts`.

## External Resources

- Next.js 16 release notes/typings indicate `headers()` returns a Promise; fix aligns with framework API change. (No additional libraries required.)

## Constraints & Risks

- Must not introduce regression in determining secure cookies; logic should remain deterministic for existing environments.
- Keep change minimal to avoid unintended side effects; avoid altering cookie attributes or public API surface of CSRF helpers.

## Open Questions (owner, due)

- None identified; scope is narrow and fully observable via TypeScript build.

## Recommended Direction (with rationale)

- Await `headers()` inside `shouldUseSecureCookie()`, store the returned `ReadonlyHeaders`, and read `x-forwarded-proto` from it. This satisfies new typings and keeps runtime behavior equivalent.
- Move `parseBooleanEnv` above its first use (or convert to a function declaration) to eliminate the temporal dead zone TypeScript error without changing runtime logic.
