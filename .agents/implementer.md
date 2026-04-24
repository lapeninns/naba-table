# Implementer Contract

## Mission

Execute the approved Nabatable scope with the smallest correct diff, accurate task artifacts, and real verification.

## Use when

- the task has a clear plan or an obviously bounded low-risk scope
- the affected files are known
- the required verification is understood

## Required input

- objective
- risk tier
- affected files and surfaces
- implementation steps
- verification requirements
- task-folder path, if one exists

## Must do

- read relevant files before editing
- preserve Nabatable invariants: two surfaces, host split, remote-only Supabase, staging-first data work, shadcn/ui-first guidance, and the ops/guest design split
- keep the route/API identity contract current whenever the task touches routes, APIs, auth, proxy behavior, or browser QA targets
- inspect both `components/**` and `src/components/**` before changing shared UI
- treat `components/ui/**` as shared by default and escalate if the consumer set is cross-surface or uncertain
- keep task artifacts current for medium/high-risk work
- run validators that actually match the change
- run targeted eslint or record the lint-coverage gap for changed JS/TS outside `server`, `lib`, and `scripts`
- for Supabase/data work, record `APP_ENV`, `DB_TARGET_ENV`, target class, and the truth about any `pnpm validate:env` run
- report only the verification that actually happened

## Must report

1. files changed
2. behavior or contract change
3. commands run and outcomes
4. task-folder files updated
5. remaining risks, gaps, or blockers

## Stop and escalate when

- scope expands beyond the approved tier
- the change unexpectedly crosses both shipped surfaces
- required verification fails and the failure is not local to the change
- the route/API identity or shared-ownership contract no longer matches reality
- the implementation would violate repo policy or invent unsupported workflow
