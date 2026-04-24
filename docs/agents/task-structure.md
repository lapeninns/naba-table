# Task Structure

## Naming

`tasks/<slug>-YYYYMMDD-HHMM/` (UTC)

Examples: `user-auth-flow-20250110-1430`, `fix-avatar-cropping-20260301-0900`

## Required Contents

```
tasks/<slug>-YYYYMMDD-HHMM/
├── research.md       # Requirements and analysis
├── plan.md           # Design, architecture, API contracts, tests, rollout
├── todo.md           # Live implementation checklist
├── verification.md   # QA results, perf/a11y, sign-offs
└── artifacts/        # Lighthouse JSON, HAR, screenshots, db diffs
```

## Frontmatter (all task files)

```yaml
---
task: <slug>
timestamp_utc: <ISO-8601 Z>
owner: github:@<handle>
reviewers: [github:@<handle>]
risk: low|medium|high
flags: [<feature_flag_keys>]
related_tickets: [<TICKET-123>]
---
```

## File Templates

### research.md

```markdown
# Research: <Feature/Change Name>

## Requirements

- Functional:
- Non-functional (a11y, perf, security, privacy, i18n):

## Existing Patterns & Reuse

- ...

## External Resources

- [Spec/Doc](url) — why it matters

## Constraints & Risks

- ...

## Open Questions (owner, due)

- Q: ... A: ...

## Recommended Direction (with rationale)

- ...
```

### plan.md

```markdown
# Implementation Plan: <Feature/Change Name>

## Objective

We will enable <user> to <goal> so that <outcome>.

## Success Criteria

- [ ] <metric/condition>

## Architecture & Components

- <ComponentA>: role

## Data Flow & API Contracts

Endpoint: METHOD /api/...
Request: { ... }
Response: { ... }
Errors: { code, message }

## UI/UX States

- Loading / Empty / Error / Success

## Edge Cases

- ...

## Testing Strategy

- Unit / Integration / E2E / Accessibility

## Rollout

- Feature flag: <flag_name>
- Exposure: 10% → 50% → 100%
- Kill-switch: <how to disable>

## DB Change Plan (if applicable)

- Backup reference: <snapshot/PITR>
- Dry-run evidence: artifacts/db-diff.txt
- Rollback plan: <steps>
```

### todo.md

```markdown
# Implementation Checklist

## Setup

- [ ] Create/extend components
- [ ] Add feature flag (default off)

## Core

- [ ] Data fetching / mutations
- [ ] Validation & error surfaces

## UI/UX

- [ ] Responsive layout
- [ ] Loading/empty/error states
- [ ] A11y roles, labels, focus management

## Tests

- [ ] Unit
- [ ] Integration
- [ ] E2E
- [ ] Accessibility

## Notes

- Assumptions:
- Deviations:
```

### verification.md

```markdown
# Verification Report

## Manual QA

- [ ] No console errors
- [ ] Network requests match contract
- [ ] Semantic HTML verified
- [ ] ARIA attributes correct
- [ ] Focus order logical and visible
- [ ] Keyboard-only flows succeed

## Performance (mobile, 4× CPU, 4G)

- FCP: <value>s | LCP: <value>s | CLS: <value> | TBT: <value>ms
- Budgets met: [ ] Yes [ ] No

## Device Testing

- [ ] Mobile (≈375px) [ ] Tablet (≈768px) [ ] Desktop (≥1280px)

## Test Outcomes

- [ ] Happy paths
- [ ] Error handling
- [ ] A11y (axe): 0 critical/serious

## Artifacts

- Lighthouse: artifacts/lighthouse-report.json
- Network: artifacts/network.har

## Known Issues

- [ ] <issue> (owner, priority)

## Sign-off

- [ ] Engineering
- [ ] Design/PM
```
