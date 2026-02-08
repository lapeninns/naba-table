---
task: update-env-local
timestamp_utc: 2026-02-08T12:00:00Z
owner: github:@copilot
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Update .env.local values

## Requirements

- Functional: Update .env.local with provided Clarity project id and Supabase credentials.
- Non-functional (a11y, perf, security, privacy, i18n): Do not leak secrets in docs or responses. Do not commit .env.local.

## Existing Patterns & Reuse

- Use existing env keys defined in config/env.schema.ts.

## External Resources

- None.

## Constraints & Risks

- Secrets must remain local and uncommitted.

## Open Questions (owner, due)

- Q: Any additional env keys to update beyond Clarity and Supabase? (owner: github:@copilot, due: 2026-02-08)

## Recommended Direction (with rationale)

- Update .env.local keys that map to the provided values; avoid logging secrets.
