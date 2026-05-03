# Nabatable platform

Nabatable is a Lapen Inns reservation and restaurant operations platform built with Next.js 16, React 19, TypeScript, Supabase, and pnpm workspaces. The repo ships public/guest booking routes, authenticated restaurant ops routes, a standalone Reserve Vite app, and Cloudflare Workers.

## Main surfaces

| Surface          | Purpose                                                                           | Source paths                                                                  |
| ---------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Public and guest | Marketing, restaurant discovery, booking, guest account flows                     | `src/app/(public)/**`, `src/app/guest/**`, `src/components/features/guest/**` |
| Restaurant ops   | Dashboard, bookings, customers, settings, menu, tables, team, delivery dashboards | `src/app/app/**`, `src/components/features/**`, `src/services/ops/**`         |
| API/domain       | Next route handlers backed by server modules and Supabase                         | `src/app/api/**`, `server/**`, `lib/**`                                       |
| Reserve          | Standalone Vite reservation app                                                   | `reserve/**`                                                                  |
| Edge/jobs        | Workers, cron routes, queue processing                                            | `cloudflare/**`, `src/app/api/cron/**`, `server/jobs/**`                      |

Start with [Architecture](architecture.md), then jump to [Systems](../systems/index.md) or [Features](../features/index.md) depending on the change.
