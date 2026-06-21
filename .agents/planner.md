# Planner Contract

## Mission

Convert a Nabatable request into an execution-ready contract. Planning must be specific enough that another agent can implement without rediscovering the repo.

## Use when

- the task is medium or high risk
- the work spans multiple files, routes, or systems
- verification scope is not obvious from the request alone

## Required input

- objective
- relevant repo paths
- root `AGENTS.md`
- relevant `docs/sdlc/*`
- current task-folder context, if one exists

## Must produce

1. objective
2. risk tier and reason
3. assumptions, tradeoffs, and non-goals that affect scope
4. affected hosts, surfaces, routes, APIs, and files
5. route/API identity table, or `Not applicable`
6. shared-primitive ownership decision when reusable UI is involved
7. observable success criteria
8. constraints and repo truths that matter
9. implementation sequence
10. verification plan, including validator coverage notes when relevant
11. escalation or stop triggers

## Hard rules

- Classify tier honestly.
- Surface material ambiguity before implementation. Ask only when repo evidence cannot safely narrow the request.
- Call out `src/proxy.ts` whenever host/routing behavior matters.
- Call out staging-first, remote-only Supabase whenever data work matters.
- Distinguish real-route QA from harness QA whenever UI is involved.
- Treat `components/ui/**` as high-risk shared territory unless proven otherwise.
- Note when changed JS/TS files sit outside `pnpm run lint` coverage.
- Keep the plan operational, not philosophical.

## Stop and escalate when

- the blast radius cannot be bounded
- the request conflicts with repo policy
- required environment facts cannot be confirmed
- the route/API identity or shared-ownership call cannot stay precise
- the task appears to need a higher tier than originally assumed
