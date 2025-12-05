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

- Small, focused utilities that wrap external services (HTTP API, OpenAI GPT, Resend email, SEO meta helpers).
- Intended to be framework-agnostic and reusable by app and server code.

## Guidelines

- Keep modules minimal and composable; no React/Next imports.
- External calls must surface clear errors and avoid leaking secrets; read config from env only.
- If adding GPT/email integrations, document rate limits and privacy considerations in task files.
- Maintain separation: `libs` should not import from `src/app` or UI layers.

## Build & Test Commands

- `pnpm lint` / `pnpm typecheck` — ensure utilities stay compatible.
- `pnpm test` — add/maintain tests for new logic; mock external services.

## Links

- Root AGENTS: `/AGENTS.md`
- Shared core: `lib/**`
- Server usage: `server/**`
