---
task: sms-template-send
timestamp_utc: 2026-04-13T10:19:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: SMS Template Send

## Objective

We will send the current canonical SMS templates to the provided phone number using the repo's real Twilio sender and canonical message builders.

## Success Criteria

- [ ] Manager daily summary sample sent successfully.
- [ ] Guest confirmation sample sent successfully.
- [ ] Guest update sample sent successfully.
- [ ] Guest customer-cancelled sample sent successfully.
- [ ] Guest restaurant-cancelled sample sent successfully.
- [ ] Verification notes include message SIDs and rendered bodies.

## Testing Strategy

- Use a one-off CLI invocation with production-style env vars loaded from the repo env bundle.
- Capture Twilio responses and rendered message bodies into verification artifacts.
