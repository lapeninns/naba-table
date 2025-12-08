---
task: revamp-wizard-steps
timestamp_utc: 2025-12-08T00:13:26Z
owner: github:@amanshresthaa
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Revamp Booking Wizard Steps

## Requirements

1.  **Eliminate Redundancy (Step 4)**: Fixed the "double alert" issue where multiple success indicators might appear.
2.  **Consistency (Steps 1-4)**: Ensure all steps share the same "Premium" visual language ("Midnight Majesty" tokens, Glassmorphism where appropriate, clean typography).
3.  **Copywriting**: Improve copy to be clearer, more welcoming, and professional.

## Analysis of Current State

- **Step 1 (Plan)**: Uses `PlanStepForm`. Title "Plan your visit" is functional but a bit dry.
- **Step 2 (Details)**: Uses cards. Title "Tell us how to reach you" is okay but could be friendlier. Input fields are standard.
- **Step 3 (Review)**: Recently updated to "Ticket" style.
- **Step 4 (Confirmation)**: Recently updated, but has potential redundancy in alerts.

## Proposed Copy Changes

- **Step 1**:
  - Title: "When would you like to join us?"
  - Description: "Select your preferred date, time, and party size."
- **Step 2**:
  - Title: "Your Details"
  - Description: "Where should we send your booking confirmation?"
- **Step 3**:
  - Title: "Review & Confirm"
  - Description: "Please review your reservation details below."
- **Step 4**:
  - Title: "Booking Confirmed!" (Dynamic based on state)
  - Description: "We look forward to seeing you. A confirmation email has been sent."

## Design Improvements

- **Step 1**: Ensure the form grid matches the "Card" aesthetic of other steps.
- **Step 2**: Refine the input styling to be "premium" (e.g., taller inputs, subtle borders).
- **Step 4**: Hide the `Alert` component if the feedback variant is 'success' and the message is just a generic completion message, relying on `GuestStatus` instead. Or improved logic: _Only_ use `GuestStatus` for the main booking state, and `Alert` for _subsequent_ user actions (like "Copy to clipboard" success).

## Constraints

- Keep functionality intact (form definitions, handlers).
- Mobile responsive.
