---
spec_id: MS-foundation-micro-spec-governance
status: verified
risk_class: docs-tooling
owner: agent:governance
last_reviewed: 2026-06-20
allowed_blast_radius:
  - scripts/check-micro-specs.mjs
  - tests/micro-specs/**
  - package.json
implementation_surfaces:
  - scripts/check-micro-specs.mjs
  - tests/micro-specs/check-micro-specs.test.ts
related_docs:
  - micro-specs/README.md
  - micro-specs/GLOBAL_CONTEXT.md
  - Instructions_MircroSpecsCreation.md
  - Instructions_tdd.md
related_tests:
  - tests/micro-specs/check-micro-specs.test.ts
verification_gates:
  - pnpm guard:micro-specs
  - pnpm exec vitest run tests/micro-specs/check-micro-specs.test.ts
approved_exceptions: []
---

# Micro-Spec Governance Validator

> This spec is also the **canonical worked example**. New specs copy its metadata block and
> the six section headings below (order fixed by `Instructions_MircroSpecsCreation.md`).

## 1. Exact Goal and User-Visible Outcomes

An AI agent or maintainer can run a single command and learn, deterministically, whether every
Micro-Spec in the corpus conforms to the governance contract in `micro-specs/README.md`.

- Running `pnpm guard:micro-specs` prints `PASSED: N micro-spec(s) valid.` and exits `0` when
  the corpus is clean, or prints one `ERROR:` line per problem (naming the file and the exact
  defect) and exits `1` when any spec is malformed.
- The check is offline and side-effect-free: it reads files only, touches no network, no
  Supabase, and no environment secrets, so it is safe to run anywhere, anytime.
- A spec that claims `verified` cannot lie about being tested: the check fails unless its cited
  tests actually exist on disk.

## 2. Blast Radius: In Scope and Out of Scope

**In scope** (`allowed_blast_radius`):

- `scripts/check-micro-specs.mjs` — the validator.
- `tests/micro-specs/**` — its Vitest contract.
- `package.json` — the `guard:micro-specs` script entry only.

**Out of scope:** authoring or editing any product Micro-Spec; changing the metadata schema or
risk_class taxonomy (owned by `micro-specs/README.md`); wiring the validator into the `lint`
chain or CI config; any runtime, route, proxy, auth, or data behavior. The validator must not
add npm dependencies — Node built-ins only.

## 3. Strict Constraints and Assumptions

- Dependency-free ESM, mirroring `scripts/check-*.mjs` conventions (`error/warn/info`,
  `process.exit(1)` on failure). No YAML library — parse the documented frontmatter subset
  (scalars, inline `[]`, block lists) directly.
- A "spec file" is any `*.md` under a `micro-specs/<area>/` subfolder; top-level
  `micro-specs/*.md` are governance docs and are exempt.
- Validation logic is a pure function with filesystem and `package.json` access injected, so it
  is unit-testable without touching the real tree (`Instructions_tdd.md` test-tier guidance).
- `allowed_blast_radius` / `implementation_surfaces` are scope declarations and may name
  not-yet-created paths, so they are **not** existence-checked. `related_docs` are existing
  documents and **are** existence-checked.

## 4. Decisions Already Made

- The metadata schema, status enum, risk_class taxonomy, `spec_id` shape, and the
  risk_class → gate mapping are defined in `micro-specs/README.md` and are reused verbatim —
  the validator does not invent a parallel schema.
- `verification_gates` are considered real if they name a `package.json` script (`pnpm <s>`,
  `pnpm run <s>`, or bare `<s>`) or a known `pnpm exec` tool (`vitest`, `playwright`,
  `prettier`, `eslint`, `tsc`).
- The always-on gate is the Vitest test (runs under `pnpm exec vitest`); `guard:micro-specs`
  is the manual/CI entry point. Wiring into `lint`/CI is a separate, approved change.

## 5. Behavioral Requirements Using EARS Notation

- THE validator SHALL treat every `*.md` inside a `micro-specs/<area>/` folder as a spec and
  SHALL exempt top-level `micro-specs/*.md` governance docs.
- THE validator SHALL require `allowed_blast_radius`, `implementation_surfaces`, `related_docs`,
  `related_tests`, and `verification_gates` to be present and non-empty.
- IF a spec file has no YAML frontmatter block, THEN THE validator SHALL report an error and
  fail the run.
- IF a required metadata key is absent, THEN THE validator SHALL report an error naming the key.
- IF `status` is not one of the documented values, THEN THE validator SHALL reject the spec.
- IF `risk_class` is outside the documented taxonomy, THEN THE validator SHALL reject the spec.
- IF `spec_id` does not match `MS-<area>-<slug>` in lowercase, THEN THE validator SHALL reject
  the spec.
- IF `last_reviewed` is not a real `YYYY-MM-DD` calendar date, THEN THE validator SHALL reject
  the spec.
- IF a `related_docs` entry does not resolve to a file on disk, THEN THE validator SHALL reject
  the spec.
- WHERE a spec's status is `implemented` or `verified`, THE validator SHALL require every
  `related_tests` entry to resolve to a file on disk.
- IF a `verification_gate` names no real command, THEN THE validator SHALL reject the spec.
- WHEN invoked as `pnpm guard:micro-specs`, THE validator SHALL exit `0` if every spec is valid
  and SHALL exit non-zero otherwise.

## 6. Verification Criteria and Task Breakdown

**Acceptance (observable):**

- `pnpm guard:micro-specs` exits `0` against the committed corpus and `1` when any spec is
  malformed, naming the file and the defect.
- `pnpm exec vitest run tests/micro-specs/check-micro-specs.test.ts` passes, with a passing and
  a failing case for each rule above (triangulated).

**Behaviors covered by tests:** a fully-valid spec is accepted; a missing frontmatter block is
rejected; each missing required key is reported by name; out-of-enum `status`/`risk_class` are
rejected; malformed `spec_id` and impossible dates (e.g. `2026-02-30`, `2026-13-01`) are
rejected; an empty required list is rejected; an unresolved `related_docs` path is rejected; a
`verified`/`implemented` spec with an absent test is rejected while a `draft`/`active` one is
not; an unrecognized `verification_gate` is rejected; the path/glob resolver and spec collector
behave against a temp fixture; and `runCheck` passes/fails end-to-end against a temp repo.

**Task breakdown:** (1) Red — author the Vitest contract; (2) Green — implement the validator
rule by rule, triangulating each; (3) author this corpus and dogfood the validator against it;
(4) refactor under green; (5) add the `guard:micro-specs` script.
