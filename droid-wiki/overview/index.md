# Nabatable platform

Nabatable is a Lapen Inns reservation and restaurant operations platform built with Next.js 16, React 19, TypeScript, Supabase, and pnpm. This wiki snapshot was refreshed from branch `main` at commit `dd83ed933caee0978331239201255e273c285dc2` on 2026-05-30T17:24:07Z.

## Main surfaces

| Surface          | Purpose                                                                                                  | Source paths                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Public and guest | Marketing, restaurant discovery, public booking, guest accounts, receipts, and recovery flows.           | `src/app/(public)/**`, `src/app/guest/**`, `src/components/features/guest/**`             |
| Restaurant ops   | Operator dashboard, bookings, customers, settings, tables, menu, team, delivery, and GBP dual-sync.      | `src/app/app/**`, `src/components/features/**`, `src/hooks/ops/**`, `src/services/ops/**` |
| API/domain       | Next route handlers backed by server modules, Supabase, provider integrations, and job orchestration.    | `src/app/api/**`, `server/**`, `lib/**`                                                   |
| Reserve          | Standalone Vite/React Router reservation wizard sharing booking adapters and API contracts.              | `reserve/**`                                                                              |
| Edge and jobs    | Cloudflare Workers, Vercel cron routes, queue workers, email processing, SMS summaries, and short links. | `cloudflare/**`, `src/app/api/cron/**`, `server/jobs/**`, `server/queue/**`               |

Start with [Architecture](architecture.md), then jump to [Systems](../systems/index.md), [Features](../features/index.md), or [API](../api/index.md).
