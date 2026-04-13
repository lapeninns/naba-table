---
task: sms-template-send
timestamp_utc: 2026-04-13T10:19:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Live SMS Send

- Recipient: `+447467586751`
- Env source: `.env.tmp.production` with existing Twilio credentials
- Restaurant context for manager summary sample: `The Old Crown Girton` (`a050d1ad-1ee0-4ea0-abc2-22c3778aa52c`)

### Results

- `manager_daily_summary`
  - SID: `SM735300a22a4e819f6eab48b3aa249423`
  - Status: `accepted`
  - Body: `The Old Crown Girton: Today 1 bkgs, 2 covers. Lunch 0/0. Dinner 1/2.`
- `guest_confirmation`
  - SID: `SMf2fa1afe7488ad2ce0b8a7946ae77fa6`
  - Status: `accepted`
  - Body:
    `The Old Crown Girton`
    blank line
    `Your booking is confirmed.`
    `Tue, 14 Apr 2026 at 18:30 | 4 guests`
    `Reference: TEST-AB12`
    blank line
    `Manage your booking: https://go.nabatable.com/m/TESTAB12`
- `guest_update`
  - SID: `SM645b09d2a61707ff6fec031776c0086b`
  - Status: `accepted`
  - Body:
    `The Old Crown Girton`
    blank line
    `Your booking has been updated.`
    `Tue, 14 Apr 2026 at 18:30 | 4 guests`
    `Reference: TEST-AB12`
    blank line
    `Manage your booking: https://go.nabatable.com/m/TESTAB12`
- `guest_cancellation_customer`
  - SID: `SM6ca424ccb06061598447b7566dc9773b`
  - Status: `accepted`
  - Body:
    `The Old Crown Girton`
    blank line
    `Your booking has been cancelled.`
    `Tue, 14 Apr 2026 at 18:30 | 4 guests`
    `Reference: TEST-AB12`
    blank line
    `Contact: 01223 277217`
- `guest_cancellation_restaurant`
  - SID: `SM849119a3a366e3878a2ab7db073f945a`
  - Status: `accepted`
  - Body:
    `The Old Crown Girton`
    blank line
    `Your booking has been cancelled by the restaurant.`
    `Tue, 14 Apr 2026 at 18:30 | 4 guests`
    `Reference: TEST-AB12`
    blank line
    `Contact: 01223 277217`

## Artifacts

- `artifacts/send-results.json`
- `artifacts/send_sms_templates.ts`
