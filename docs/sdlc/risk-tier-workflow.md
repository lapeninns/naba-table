# Risk-Tier Workflow

Choose the lowest tier that still matches the real blast radius. When in doubt, escalate.

## Identity and ownership gate

Before finalizing the tier for routing, API, auth, proxy, or shared-UI work:

- fill the route/API identity contract
- decide whether the edit lives on the root host, app host, or both
- treat `components/ui/**` as cross-surface by default
- treat `src/components/ui/**` and other exported primitives as shared until a consumer scan proves otherwise

Missing identity or ownership facts is an escalation trigger, not a license to guess.

## Tier matrix

| Tier       | Use when                                                                                                                                                                            | Task folder  | Planning contract                                                       | Implementation contract                                      | Review / handoff contract                                   | Minimum verification                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Low**    | Single-file or tightly bounded work with no shared contract change, no cross-host behavior, no auth/data risk, and no shared primitive impact                                       | Not required | Inline plan is enough                                                   | Minimal scoped edit                                          | Concise summary of files, checks, and residual risk         | Targeted check matched to the edit                                      |
| **Medium** | One surface, one workflow, docs/process rewrites, or reusable code proven to affect only one surface and one risk boundary                                                          | Required     | `research.md` and `plan.md` before implementation                       | Keep `todo.md` current and stay inside approved scope        | Handoff must include verification evidence and gaps         | Verification required by change type in `verification.md`               |
| **High**   | Cross-surface work, `src/proxy.ts`, auth/security, tenant isolation, Supabase writes/migrations, destructive operations, or shared primitives that affect both ops and guest/public | Required     | Full task folder before edits; include rollback or containment thinking | Sequence changes carefully and document boundary assumptions | Independent review is expected; evidence must be replayable | Strongest matching checks plus evidence in `artifacts/` when applicable |

## Nabatable default classifications

### Low by default

- narrow copy changes
- docs-only edits outside the operating layer
- isolated refactors with no contract change

### Medium by default

- meaningful work on one shipped surface
- docs/process-layer rewrites such as `docs/sdlc/*`, `.agents/*`, or task contracts
- real-route UI changes that stay inside one host/surface boundary
- exported primitives outside `components/ui/**` only when a consumer scan proves one-surface impact

### High by default

- any change to `src/proxy.ts`
- work that touches both app-host and root-host behavior
- auth, session, permission, or tenant-boundary changes
- Supabase schema, migrations, remote write paths, or destructive data operations
- any edit in `components/ui/**`
- edits in `src/components/ui/**` or other shared primitives when both surfaces consume them or the consumer set is uncertain

## Escalation triggers

Escalate immediately when any of the following becomes true:

- the route/API identity contract cannot stay precise
- the change crosses the app-host/root-host split
- a consumer scan shows both surfaces depend on the primitive being changed
- auth, security, or remote data boundaries move
- the task needs browser QA on multiple shipped routes or hosts
- the requested verification or recovery work no longer fits the current tier

## Planning expectations by tier

- **Low:** capture the plan inline and keep it short.
- **Medium:** write enough in `research.md` and `plan.md` for another agent to continue without rediscovery, including identity rows when applicable.
- **High:** define scope, boundary assumptions, shared-ownership reasoning, rollback posture, and verification evidence before implementation begins.

## Review and handoff expectations by tier

- **Low:** self-review is acceptable if the diff is obviously narrow.
- **Medium:** review must challenge scope, regressions, validator coverage, and verification quality.
- **High:** review must challenge blast radius, missing evidence, shared ownership assumptions, and rollback readiness.

## Stop rules

Stop and escalate instead of guessing when:

- the tier increases during execution
- the environment needed for required verification is unavailable
- the request conflicts with remote-only Supabase or staging-first policy
- the verification evidence cannot support the claim of done
- the host, proxy, or auth expectation of a changed route/API is still ambiguous
