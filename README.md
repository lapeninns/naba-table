# SajiloReserveX

## Reserve App Overview

The `/reserve` booking experience is now served by a feature-sliced React application that mounts inside the Next.js shell. A feature flag (`NEXT_PUBLIC_RESERVE_V2`) controls rollout between the legacy flow and the new architecture.

### Getting Started

```bash
pnpm install
pnpm dev            # Next.js shell (serves /reserve via feature flag)
pnpm reserve:dev    # Standalone Vite dev server for the Reserve app
```

### Quality Gates

| Command              | Purpose                                                     |
| -------------------- | ----------------------------------------------------------- |
| `pnpm typecheck`     | TypeScript strict mode for both Next and Reserve workspaces |
| `pnpm lint`          | ESLint with typescript-eslint, jsx-a11y, import/order rules |
| `pnpm test`          | Vitest unit/integration suite (jsdom + Testing Library)     |
| `pnpm test:e2e`      | Playwright smoke tests (scaffolding ready)                  |
| `pnpm build`         | Next production build                                       |
| `pnpm reserve:build` | Vite bundle for the Reserve app                             |
| `pnpm analyze`       | Bundle visualization report (opens analyze.html)            |

### Architecture Map

```
reserve/
  app/           # Providers, router, client entry
  entities/      # Normalised domain models (Zod schemas, adapters)
  features/      # Feature modules (reservations/wizard,...)
  pages/         # Route-level components for React Router data routes
  shared/        # API client, config, headless UI primitives, hooks
  tests/         # Vitest + MSW scaffolding (unit/integration/e2e)
```

### Migration Notes

1. Toggle `NEXT_PUBLIC_RESERVE_V2` to switch between legacy and new flows.
2. New API client normalises responses and surfaces consistent error shapes.
3. TanStack Query powers data fetching/caching; providers are colocated under `reserve/app/providers.tsx`.
4. Feature slices expose hooks first (`useReservationWizard`) with presentational components in `ui/` folders.
