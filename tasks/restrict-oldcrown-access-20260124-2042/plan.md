---
task: restrict-oldcrown-access
timestamp_utc: 2026-01-24T20:42:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Restrict Old Crown access

## Objective

Ensure `oldcrown@lapeninn.com` retains access only to Old Crown Girton.

## Success Criteria

- [ ] User exists.
- [ ] Memberships remain only for Old Crown Girton.

## Data Flow

- Direct DB updates via Supabase MCP.

## Rollback

- Reinsert deleted memberships if needed.
