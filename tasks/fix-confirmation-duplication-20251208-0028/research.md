---
task: fix-confirmation-duplication
timestamp_utc: 2025-12-08T00:28:12Z
owner: github:@amanshresthaa
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Fix Confirmation Duplication

## Requirement

User reported "still got 2 ?" referring to the double confirmation banners in Step 4.
This matches my analysis: `WizardStep` renders a header, and I added a `GuestStatus` banner inside the body.

## Solution

Remove `GuestStatus` from `ConfirmationStep.tsx`.
Rely on `WizardStep` props (`title`, `description`, `icon`) to render the status.
This ensures consistency with Steps 1-3 which also use the `WizardStep` header.

## Copy Check

`useConfirmationStep.ts` provides the copy.

- Pending: "Your request has been received..."
- Confirmed: "A confirmation email has been sent..."
  This copy is satisfactory.

## Plan

1.  Edit `ConfirmationStep.tsx` to remove `GuestStatus`.
2.  Also doing a check on `WizardStep` usage in `ReviewStep` (Step 3) to ensure it wasn't messed up by my previous attempts to fix syntax there (I had a syntax error in tool usage previously).
