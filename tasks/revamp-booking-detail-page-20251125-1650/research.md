---
task: revamp-booking-detail-page
timestamp_utc: 2025-11-25T16:50:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Revamp Booking Detail Page

## Requirements

- **Functional**:
  - Display all booking details (Date, Time, Party Size, Status, Reference, Guest Info, Notes).
  - Allow actions: Edit, Cancel, Rebook, Add to Calendar, Share, Download Confirmation.
  - Handle states: Loading, Error, Offline, Pending Allocation, Pending Review (Locked).
  - Responsive design (mobile-first).
  - SEO (JSON-LD).

- **Non-functional**:
  - **Aesthetics**: Premium, modern look with glassmorphism or clean card design.
  - **UX**: Clear hierarchy, easy access to primary actions.
  - **Performance**: Fast load, minimal CLS.
  - **Accessibility**: WCAG compliant, keyboard navigable.

## Existing Patterns & Reuse

- **Components**: `Button`, `Alert`, `Skeleton`, `StatusChip`, `EditBookingDialog`, `CancelBookingDialog`.
- **Hooks**: `useReservation`, `useOnlineStatus`.
- **Utils**: `formatDate`, `formatTimeRange`, `buildBookingDto`.

## Constraints & Risks

- **Data Availability**: Must handle cases where some data (like restaurant slug) might be missing or default.
- **State Complexity**: The page handles many states (pending lock, offline, etc.) which must be preserved in the new design.
- **Client/Server**: The page is a server component wrapping a client component. We are modifying the client component mainly.

## Recommended Direction

- **Design**:
  - Use a centered card layout with a subtle shadow/border.
  - specialized "Ticket" or "Pass" look could be cool, but a clean premium card is safer.
  - Group actions logically: Primary (Rebook/Edit) vs Secondary (Share/Download).
  - Use icons for all data fields (Calendar for date, Clock for time, User for party, etc.).
  - Improve the "Warnings" display to be less intrusive but still visible (maybe collapsible or better styled alerts).

- **Implementation**:
  - Refactor `ReservationDetailClient` to use a new layout structure.
  - Keep logic for `useReservation` and handlers.
  - Update the `return` JSX to use `Card`, `CardHeader`, `CardContent`, `CardFooter` from Shadcn if available, or custom `div`s with Tailwind.
  - Add `lucide-react` icons.

## Open Questions

- None at this stage.
