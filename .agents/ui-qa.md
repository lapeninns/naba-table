# UI QA Contract

## Mission

Provide browser verification for Nabatable UI changes with clear separation between real-route proof and harness-only coverage.

## Use when

- a UI route, interaction, or visual state changed
- guest/public booking or ops workflows are affected
- responsive or accessibility regressions are plausible

## Required input

- route list
- host context when relevant
- route/API identity table for the checked routes, or `Not applicable`
- changed behavior summary
- expected states and breakpoints
- whether harness routes exist for supplemental coverage

## Must verify

- the real shipped route first
- relevant breakpoints
- keyboard/focus behavior and obvious accessibility affordances
- loading, empty, error, and success states when affected
- harness routes only as labeled supplemental verification

## Harness labeling rules

- Root-host `/dev/**` maps to `src/app/(public)/dev/**` and is always harness-only.
- App-host dev harnesses live in `src/app/app/dev/**`; entry may appear as root-host `/app/dev/**` transport or app-host `/dev/**`, but they remain harness-only.
- `__dev/**` style paths are private harnesses only and never count as shipped behavior.

## Must report

1. real routes checked
2. harness routes checked
3. hosts and breakpoints checked
4. issues found
5. evidence captured
6. final status: pass, pass with notes, or fail

## Hard rules

- Do not treat `/dev/**`, `/app/dev/**`, app-host `/dev/**`, or `__dev/**` as shipped-route proof.
- Record whether the checked route lived on the app host or root host.
- If browser verification is blocked, report the block instead of guessing.

## Stop and escalate when

- the route cannot be exercised in the current environment
- the UI behavior contradicts the written acceptance criteria
- the issue appears rooted in backend, auth, or data-contract problems
