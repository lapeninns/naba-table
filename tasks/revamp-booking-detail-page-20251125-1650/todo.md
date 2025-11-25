# Implementation Checklist

## Setup

- [x] Import `Card`, `CardContent`, `CardHeader`, `CardFooter`, `Separator` from `@/components/ui`.
- [x] Import icons from `lucide-react`: `Calendar`, `Clock`, `Users`, `MapPin`, `User`, `Mail`, `Phone`, `MessageSquare`, `Share2`, `Download`, `CalendarPlus`.

## Implementation

- [x] Refactor `ReservationDetailClient` JSX.
  - [x] Create a "Hero" or "Header" section within the Card.
  - [x] Display Date and Time prominently.
  - [x] Grid layout for details (Guest, Contact, Notes).
  - [x] Action bar at the bottom or top-right.
- [x] Style alerts to fit the new design.
- [x] Ensure mobile responsiveness (stacking actions, adjusting padding).

## Verification

- [ ] Verify "Edit" opens the dialog.
- [ ] Verify "Cancel" opens the dialog.
- [ ] Verify "Share" and "Download" work.
- [ ] Check "Offline" state visibility.
