---
task: dast-scanning
timestamp_utc: 2026-01-29T13:07:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: DAST Scanning

## Objective

We will add a repeatable DAST workflow so security scans run via CI and produce ZAP reports.

## Success Criteria

- [ ] `.github/workflows/dast.yml` runs OWASP ZAP baseline against a local app instance.
- [ ] Workflow archives the ZAP report artifact without failing by default.

## Architecture & Components

- GitHub Actions workflow
  - Setup Node + pnpm
  - Build + start the app
  - ZAP baseline scan

## Data Flow & API Contracts

- None (workflow-only change).

## UI/UX States

- None.

## Edge Cases

- App startup latency: reuse CI wait loop before scanning.
- ZAP container reachability: target `http://localhost:3000`.

## Testing Strategy

- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Rollout

- Triggered via schedule + manual dispatch; no runtime feature flags.
