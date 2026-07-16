# Intent–reality ledger: Square Bookings API semantics

Access date: 2026-07-16

| intent_id | expected truth | observed reality | diff | invariant | intent source | observations | status | claims |
|---|---|---|---|---|---|---|---|---|
| I1 | Square exposes an authoritative service-duration field used by bookings/availability. | Pending research. | Unknown. | Duration must be represented in an official current API schema. | Assigned research axis. | Pending. | unknown | C1 |
| I2 | Availability search has explicit temporal bounds and documented constraints. | Pending research. | Unknown. | Search-window semantics must distinguish requested range from returned appointment duration. | Assigned research axis. | Pending. | unknown | C2 |
| I3 | Booking records expose start and end semantics or enough data to derive them. | Pending research. | Unknown. | Booking duration/end must not be inferred without an official field relationship. | Assigned research axis. | Pending. | unknown | C3 |
| I4 | Square documents customer lead-time, cutoff, and advance-booking-window controls. | Pending research. | Unknown. | Policy controls must be attributed to current seller/profile/API surfaces. | Assigned research axis. | Pending. | unknown | C4 |
| I5 | Location business hours are represented in an official Square API and may constrain availability. | Pending research. | Unknown. | Business-hours representation and scheduling effect must be separately sourced. | Assigned research axis. | Pending. | unknown | C5 |
| I6 | Any applicability to restaurant reservations is explicit, or clearly labeled as inference. | Pending research. | Unknown. | Appointments API evidence must not be presented as direct restaurant-reservation support. | Assigned research axis. | Pending. | unknown | C6 |
| I7 | Deprecated fields/endpoints and version-sensitive changes are identified. | Pending research. | Unknown. | Current semantics must survive counter-searches for replacement/deprecation. | Assigned research axis. | Pending. | unknown | C7 |
