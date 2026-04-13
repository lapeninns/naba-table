---
task: booking-summary-outdated-template-investigation
timestamp_utc: 2026-04-13T11:25:40Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Outdated Booking Summary Template Investigation

## Objective

We will determine why the manager booking summary SMS received around 10:00 on April 13, 2026 used outdated copy, so that production sends the approved compact venue-prefixed template consistently.

## Success Criteria

- [ ] The live production sender path for the 10:00 summary is identified.
- [ ] We can explain whether production was stale, misconfigured, or reading from a second legacy path.
- [ ] If a code or deployment fix is needed, it lands in the canonical path with verification evidence.

## Architecture & Components

- `lib/ops/daily-booking-summary.ts`: canonical summary formatter.
- `cloudflare/sms-summary-gateway/src/job.ts`: scheduled worker job.
- `cloudflare/sms-summary-gateway/src/index.ts`: worker entrypoint and scheduler binding.
- Deployment metadata from Wrangler: source of truth for what was live at send time.

## Data Flow & API Contracts

- Scheduled trigger -> worker job -> booking summary formatter -> Twilio send.
- Investigation evidence:
  - git history for copy changes
  - deployed worker versions/timestamps
  - current local formatter output

## UI/UX States

- None; backend/investigation task.

## Edge Cases

- Deployment happened after the 10:00 send.
- A stale worker version remained active on the production route.
- Another legacy sender path still exists and bypasses the updated formatter.

## Testing Strategy

- Focused CLI verification:
  - inspect formatter source and history
  - inspect worker runtime source and deployment history
  - if code changes are needed, run targeted tests/lint for touched files

## Rollout

- If a fix is needed, redeploy only `sms-summary-gateway` and capture the deployment id/timestamp.
- Confirm the next summary uses the correct copy or send a controlled proof message if safe.
