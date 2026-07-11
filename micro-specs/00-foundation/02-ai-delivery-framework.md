---
spec_id: MS-foundation-ai-delivery-framework
status: active
risk_class: docs-tooling
owner: ai-governance-starter-kit
last_reviewed: 2026-07-11
allowed_blast_radius:
  - .github/**
  - .claude/skills/**
  - AGENTS.md
  - CLAUDE.md
  - CONTINUITY.md
  - Instructions_MicroSpecsCreation.md
  - Instructions_tdd.md
  - micro-specs/**
  - package.json
  - scripts/check-governance.mjs
  - scripts/governance-constants.mjs
  - scripts/governance-io.mjs
  - scripts/governance-rules.mjs
  - scripts/governance-frontmatter.mjs
  - scripts/governance-glob.mjs
  - scripts/governance-commands.mjs
  - scripts/governance-evidence.mjs
  - scripts/governance-version.mjs
  - scripts/governance-status.mjs
  - scripts/new-spec.mjs
  - scripts/advance-spec.mjs
  - scripts/run-governance-gates.mjs
  - tests/micro-specs/**
implementation_surfaces:
  - .github/workflows/ai-governance.yml
  - .claude/skills/**
  - AGENTS.md
  - CLAUDE.md
  - CONTINUITY.md
  - Instructions_MicroSpecsCreation.md
  - Instructions_tdd.md
  - micro-specs/README.md
  - micro-specs/GLOBAL_CONTEXT.md
  - package.json
  - scripts/check-governance.mjs
  - scripts/governance-constants.mjs
  - scripts/governance-io.mjs
  - scripts/governance-rules.mjs
  - scripts/governance-frontmatter.mjs
  - scripts/governance-glob.mjs
  - scripts/governance-commands.mjs
  - scripts/governance-evidence.mjs
  - scripts/governance-version.mjs
  - scripts/governance-status.mjs
  - scripts/new-spec.mjs
  - scripts/advance-spec.mjs
  - scripts/run-governance-gates.mjs
  - tests/micro-specs/governance-enforcement.test.mjs
  - tests/micro-specs/advance-spec.test.mjs
  - tests/micro-specs/governance-evidence.test.mjs
  - tests/micro-specs/new-spec.test.mjs
related_docs:
  - micro-specs/README.md
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/governance-enforcement.test.mjs
verification_gates:
  - pnpm governance:check
  - pnpm test:micro-specs
  - pnpm lint
  - pnpm typecheck
required_playwright_projects: []
evidence_required:
  - Governance checker output.
  - Test output for Micro-Spec governance enforcement.
approved_exceptions: []
---

# AI Delivery Framework

## Intent

Install the baseline AI governance framework and keep it enforceable in this
repository.

## Scope

In scope:

- Agent entrypoint guidance.
- Micro-Spec lifecycle and metadata contract.
- Governance checker scripts.
- Active gate runner.
- Minimal Micro-Spec governance test.

Out of scope:

- Product feature implementation.
- Broad refactors unrelated to governance.
- Production deployment changes.

## Acceptance criteria

- Governance files exist in the expected locations.
- `package.json` exposes governance scripts.
- `pnpm governance:check` passes.
- Active Micro-Spec gate execution works for declared gates.
