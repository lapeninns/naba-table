# Verification Standard

No Nabatable task is complete without verification.

## Minimum verification by change type

### Code-only backend / server change

Run the narrowest meaningful set of:

- targeted tests
- `pnpm run lint`
- `pnpm run typecheck`

If the change affects a user-visible path, also verify the end-to-end behavior at the route or API boundary.

### UI change

Required:

- route-level browser verification
- responsive check at relevant breakpoints
- accessibility spot-check for focus, labels, semantics, and contrast
- loading/empty/error/success state coverage when affected

Use manual browser QA and capture evidence when the task is medium/high risk.

### Auth/security change

Required:

- negative-path verification
- permission-boundary verification
- regression coverage for the previous happy path
- explicit statement of what was not tested

### Database / Supabase change

Required:

- confirm remote-only assumptions
- validate the changed query/mutation path
- document rollback or recovery plan for high-risk work
- capture relevant evidence in the task folder

## Verification summary template

For each task, answer:

- What commands were run?
- What manual checks were performed?
- What routes or APIs were exercised?
- What evidence was captured?
- What remains unverified?

## Failure rule

If verification fails, the task is not done. Either fix the issue or document the blocker explicitly.

## Nabatable evidence guidance

Capture evidence for:

- guest booking flow changes
- operator dashboard workflow changes
- cross-route navigation or chrome changes
- performance, accessibility, or visual regressions
- high-risk state transitions and remote integrations
