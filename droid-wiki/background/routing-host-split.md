# Routing host split

`AGENTS.md` and `src/proxy.ts` make the root-host/app-host split explicit. Operators use `src/app/app/**`; guests and public visitors use `src/app/(public)/**` and `src/app/guest/**`; ops APIs remain guarded even when requested directly.

Related: [Host routing](../systems/host-routing.md).
