# Wave1C environment final gate review

recommendation: APPROVE

re-review: 2026-08-09 repaired current worktree

## Original intent

Ship a strict, fail-closed Google Business Profile environment contract: paired credential-keyring variables, bounded key identifiers, canonical unpadded base64url 32-byte keys, 1..32 entries, exact active-key membership, runtime-frozen readonly key storage, canonical-over-profile legacy precedence, and complete validated Pub/Sub verification metadata when ingress is enabled, without leaking secrets or weakening Wave0 defaults.

## Desired outcome

All malformed and adversarial environment inputs fail safely, while valid legacy and new configurations normalize predictably and expose no mutable credential-key storage.

## User outcome review

The repaired artifact satisfies the scoped environment contract. Active membership now uses `Object.hasOwn`, reserved prototype-related identifiers are rejected case-insensitively before record normalization, and normalized key storage is frozen with a null prototype. Direct probes confirmed rejection of inherited names, own and escaped reserved names, plain and Unicode-escaped duplicates, nested/object/number/null values, 33-key input, oversized input, padded encoding, and ordinary missing-active input without leaking key material. Canonical encoding, pair presence, 1..32 bounds, Pub/Sub conditional requirements and resource validation, aliases, and Wave0 defaults remain covered and green.

## Blockers

None.

## Direct remove-ai-slops and programming pass

- Production parsing is appropriately located at the Zod environment boundary and uses `unknown` rather than `any`.
- The duplicate-key scan is nontrivial but is justified by JSON's last-key-wins normalization; tests prove the intended duplicate rejection and secret-safe error behavior.
- Tests mostly assert observable parse/accessor behavior and are not deletion-only, tautological, or implementation-mirroring.
- Regression tests now directly cover inherited active names, own `__proto__`, duplicate top-level identifiers, runtime freezing, and null-prototype normalization. Additional direct probes covered escaped spellings and malformed value shapes.
- No unrelated speculative abstraction or scope drift in the three reviewed files was found.

## Checked artifacts

- `config/env.schema.ts`
- `lib/env.ts`
- `tests/lib/env.test.ts`
- `.omo/evidence/gbp-wave1c-env-doneclaim.json`
- `.omo/evidence/gbp-wave1c-env.json`
- `.omo/evidence/gbp-wave1c-env-*.log`
- Current scoped `git diff` and dirty-worktree status
- Programming TypeScript criteria and remove-ai-slops criteria

## Reproduced checks

- `node_modules/.bin/vitest run tests/lib/env.test.ts tests/config/env-schema-target.test.ts --reporter=verbose`: 48/48 passed on re-review.
- `node_modules/.bin/eslint --max-warnings=0 config/env.schema.ts lib/env.ts tests/lib/env.test.ts`: passed.
- `node_modules/.bin/prettier --check config/env.schema.ts lib/env.ts tests/lib/env.test.ts`: passed.
- `pnpm typecheck`: passed (only the repository's pnpm configuration warning was emitted).
- `git diff --check -- config/env.schema.ts lib/env.ts tests/lib/env.test.ts`: passed.
- Direct secret grep across Wave1C evidence for known fixture material: no matches.
- Direct adversarial schema probes: all expected rejection/acceptance outcomes reproduced; no fixture secret appeared in formatted issues.

## Evidence gaps and notes

- No separate code-review report, manual-QA matrix, or notepad path was supplied. The done-claim and evidence directory were inspected directly; this absence is not an additional blocker because the direct pass reproduces the decisive criterion failure.
- Evidence logs are untracked and the worktree contains many unrelated concurrent changes. The focused current-state checks were rerun, so the recommendation does not rely solely on stale success prose.
- External Pub/Sub infrastructure and deployment values remain unverified, as the done-claim itself states; this is not a blocker for the scoped schema contract.
