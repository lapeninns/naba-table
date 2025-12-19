---
task: revamp-wizard-steps
timestamp_utc: 2025-12-08T00:13:26Z
owner: github:@amanshresthaa
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Revamp Booking Wizard

## Objective

Polish Steps 1-4 with consistent design and improved copy, removing redundancy in Step 4.

## Plan

1.  **Step 4 (Confirmation) Redundancy Fix**:
    - Modify `ConfirmationStep.tsx`.
    - Logic: Ensure `feedback` is only shown explicitly for user-initiated actions (like sharing), not for the initial "Booking Confirmed" state (which is covered by `GuestStatus`).
    - Verify `GuestStatus` covers the "Success" messaging adequately.

2.  **Step 1 (Plan) Polish**:
    - Update `PlanStep.tsx` copy.
    - Check `PlanStepForm` (if needed, though `PlanStep` wrapper might be enough for copy).
    - Ensure styling matches consistency.

3.  **Step 2 (Details) Polish**:
    - Update `DetailsStep.tsx`.
    - Refine Title/Description copy.
    - Minor CSS tweaks for "Premium" feel (taller inputs, better spacing).

4.  **Step 3 (Review) Polish**:
    - Review copy.
    - Ensure it matches the flow. (Already largely done, just sanity check).

5.  **Verification**:
    - Walkthrough to ensure flow feels cohesive.

## Step-by-Step

- **Edit `ConfirmationStep.tsx`**: Filter feedback messages or adjusting layout to prevent double-banner.
- **Edit `PlanStep.tsx`**: Update `TITLE` and `DESCRIPTION`.
- **Edit `DetailsStep.tsx`**: Update Titles and Descriptions. Improve Form styles.
