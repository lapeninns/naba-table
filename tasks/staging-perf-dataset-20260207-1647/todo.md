---
task: staging-perf-dataset
timestamp_utc: 2026-02-07T16:47:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Add `scripts/staging/seed-perf-dataset.ts` (dry-run default, `--apply` to write).
- [ ] Add `scripts/staging/replay-perf-workload.ts` (writes artifacts into this task folder).

## Execute (Staging Only)

- [ ] Run connectivity check: `npx tsx scripts/check-staging-supabase.ts`
- [ ] Dry-run seed plan: `npx tsx scripts/staging/seed-perf-dataset.ts`
- [ ] Apply seed: `npx tsx scripts/staging/seed-perf-dataset.ts --apply`
- [ ] Replay workload: `npx tsx scripts/staging/replay-perf-workload.ts`

## Verify

- [ ] Capture counts and write to `verification.md`.
- [ ] Confirm artifacts created under `artifacts/`.
