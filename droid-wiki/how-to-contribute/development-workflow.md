# Development workflow

Keep diffs scoped, declare route/API identity for route, handler, proxy, auth, or browser-QA changes, and keep task folders current when required. `src/proxy.ts` makes host context important for many route changes.

## Risk defaults

| Tier   | Typical Nabatable examples                                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------------------------------- |
| Low    | Narrow copy/docs outside operating-layer contracts, isolated refactors with no contract change.                             |
| Medium | One-surface workflow work, broad docs/process rewrites, route UI changes within one host.                                   |
| High   | `src/proxy.ts`, auth/security, tenant isolation, Supabase migrations/writes, destructive operations, and shared primitives. |

Related: [Patterns and conventions](patterns-and-conventions.md).
