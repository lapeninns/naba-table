---
task: enhance-booking-steps
timestamp_utc: 2025-12-08T00:06:24Z
owner: github:@amanshresthaa
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Enhance Booking Steps 3 & 4

## Requirements

The user wants to enhance Step 3 (Review) and Step 4 (Confirmation) of the booking flow.
"Looks like we need to enhance them."

### Functional Requirements

- **Review Step (Step 3)**:
  - Should clearly summarize the booking details.
  - Should allow easy editing of details.
  - Should look "premium" (Glassmorphism, clean typography).
  - Should likely have a clear Call to Action (CTA).
- **Confirmation Step (Step 4)**:
  - Should confirm success unambiguously.
  - Should provide "Add to Calendar" options.
  - Should provide "Get Directions".
  - Should allow "Manage Booking" or "View Profile".
  - Should look celebratory but professional.

### Non-functional Requirements

- **Aesthetics**: Premium, "Midnight Majesty" theme (dark mode compatible, rich colors).
- **Performance**: Instant feedback.
- **Accessibility**: Clear focus management, ARIA labels.

## Existing Patterns & Reuse

- `WizardStep` is the container.
- `GuestCard` is used for content.
- `Shadcn` components available.
- "Midnight Majesty" tokens (`bg-surface-base`, `text-foreground`, etc).

## Constraints & Risks

- Must not break the booking logic.
- Must remain responsive (mobile-first).

## Open Questions

- Specific enhancements desired? (Assumption: UI polish + standard confirmation features).

## Recommended Direction

1.  **Refactor Review Step**:
    - Use a "Ticket" or "Receipt" style layout for the review.
    - Add clear iconography for Date, Time, Guests.
    - Add a "Special Requests" highlight if present.
    - Terms & Conditions checklist (if not in details).
2.  **Refactor Confirmation Step**:
    - Add a "Success" animation (lottie or framer-motion).
    - Add "Add to Calendar" (.ics generation or links).
    - Add "Share" functionality?
    - prominent "Manage Booking" link.
