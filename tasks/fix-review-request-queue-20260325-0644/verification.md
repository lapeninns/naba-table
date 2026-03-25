---
task: fix-review-request-queue
timestamp_utc: 2026-03-25T06:44:27Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Not applicable

### Console & Network

- [ ] No UI changes in scope

### DOM & Accessibility

- [ ] No UI changes in scope

### Performance (profiled; mobile; 4× CPU; 4G)

- Not applicable

### Device Emulation

- Not applicable

## Test Outcomes

- [x] Pre-deploy gateway evidence captured
- [x] Production Cloudflare gateway redeployed to version `27a52635-248c-483a-b9bd-c5450ae5bfc9`
- [x] Post-deploy gateway detail counts now match queue summary counts (`delayed: 32`)
- [x] Post-deploy queue detail includes Old Crown Girton jobs and target booking `e93fbe2c-2d3c-427f-9c2d-a0407dc0daad`
- [x] Target booking is queued as `review_request__e93fbe2c-2d3c-427f-9c2d-a0407dc0daad` for `2026-03-25T10:55:00Z`
- [x] Production `email_delivery_log` still correctly shows no review delivery before the scheduled send time

## Artifacts

- Pre-deploy deployments: `artifacts/predeploy-deployments.txt`
- Pre-deploy queue status: `artifacts/predeploy-queue-status.json`
- Pre-deploy delivery log: `artifacts/predeploy-delivery-log.json`
- Post-deploy deployments: `artifacts/postdeploy-deployments.txt`
- Post-deploy queue status: `artifacts/postdeploy-queue-status.json`
- Post-deploy delivery log: `artifacts/postdeploy-delivery-log.json`

## Known Issues

- [x] Live Cloudflare gateway detail output cap fixed by redeploying the current worker source.
- [ ] Review email delivery itself will not appear in `email_delivery_log` until after `2026-03-25T10:55:00Z`.

## Sign-off

- [x] Engineering
