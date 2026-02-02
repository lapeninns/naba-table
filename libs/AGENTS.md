---
agents_version: 5.3
scope: subproject
extends: ../AGENTS.md
last_updated: 2025-12-03
owner: github:@core-platform
profile: shared-lib
---

# AGENTS.md — Libs (`libs/`)

> Inherits root `/AGENTS.md`. Applies to helper modules in `libs/**` (API client, GPT helpers, Resend integration, SEO utilities).

## Overview

- `api.ts` — lightweight fetch wrapper used by the guest dashboard + Reserve SPA.
- `gpt.ts` — OpenAI helper powering concierge/assistant features (uses env-configured API key; rate-limited upstream).
- `resend.ts` — Resend email integration shared by booking confirmations & ops alerts.
- `seo.tsx` — canonical meta/OG helper for Next.js App Router pages.

These modules wrap external vendors so the rest of the repo can remain agnostic.

## Guidelines

1. **Framework-agnostic**
   - No React/Next imports; `seo.tsx` may export JSX helpers but should not pull in route components.
2. **Configuration**
   - Never hardcode secrets; read keys + sender domains via `process.env` and validate inside the helper (throw descriptive errors when missing).
   - Track vendor-specific headers (Resend `X-Entity-Ref-ID`, OpenAI model names) in constants for easier rotation.
3. **Error Handling**
   - Surface structured errors so callers can distinguish vendor errors vs usage errors.
   - Redact PII before logging email payloads or GPT prompts; lean on `lib/logger.ts` for structured logs.
4. **Documentation in Tasks**
   - For GPT or email template additions, document rate limits, prompt tokens, or compliance constraints inside the task’s `research.md`/`plan.md`.

## Build Commands

- `pnpm lint libs/**`
- `pnpm typecheck --filter libs`

## Links

- Root AGENTS: `/AGENTS.md`
- Shared core helpers: `lib/**`
- Server usage: `server/**`
