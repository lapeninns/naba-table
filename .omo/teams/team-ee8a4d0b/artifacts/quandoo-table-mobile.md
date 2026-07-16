# Quandoo table management, seating, availability, duration, and mobile evidence

Research axis owner: D / table-plan-mobile  
Access date: 2026-07-16  
Scope: official Quandoo documentation, official Quandoo restaurant product pages, and publisher-controlled Apple/Google app listings.

## Method

Two research waves were run.

- Wave 1 covered table management, table plans, reservation settings, availability, opening-hours terms, and interactive table-plan wording.
- Wave 2 covered mobile/app listings, table assignment, shift/workload views, reservation lifecycle/end time, and counter-searches for closing-time/end-cutoff rules.

At least 13 distinct queries were attempted. Nine query executions returned indexed material; later searches/page opens repeatedly aborted in the browsing service. Direct official-page retrieval was also attempted through the blocked-page escalation engine, but the local Python runtime stalled during import and was interrupted. This access failure is recorded as a gap rather than treated as negative evidence.

Representative distinct queries:

1. `site:business.quandoo.com Quandoo table management`
2. `site:quandoo.com Quandoo table plan restaurant`
3. `site:quandoo.com Quandoo reservation duration`
4. `site:docs.quandoo.com availability duration table area reservation time`
5. `site:docs.quandoo.com opening hours reservation times Quandoo`
6. `site:restaurants.quandoo.com "interactive table plan"`
7. `Quandoo for Restaurants app official iOS table plan`
8. `Quandoo restaurant management app Google Play table plan`
9. `site:restaurants.quandoo.com "mobile" "table plan" Quandoo`
10. `site:restaurants.quandoo.com/en-gb/features reservation management table plan mobile app`
11. `site:restaurants.quandoo.com "workload chart" Quandoo`
12. `site:docs.quandoo.com "end_date" reservation Quandoo`
13. `Quandoo "endTime" "startTime" reservation official docs`

Queries 10-13 and subsequent full-page opens were tool-aborted. Their failure does not establish absence.

## Primary-source evidence

### 1. Quandoo API terminology

URL: https://docs.quandoo.com/quandoo-terminology/

Exact labels/terms:

- `Area`
- `Availability`
- `Capacity`
- `Occupancy`
- `Reservation`
- `CHECK_IN`
- `AUTOMATIC_CHECK_OUT`
- `CHECK_OUT`

Key short quotations:

- “Availability is calculated real time.”
- “Value 0 means that the restaurant is fully available.”
- “100 means that there are no tables available.”
- “after a period of time after the end_date”

Findings:

- An area contains tables and each table’s capacity.
- Availability is a combination of date/time, guest count, and restaurant setup.
- Occupancy is represented as a percentage from fully available to fully booked.
- A reservation contains guest count, date, and time.
- Quandoo distinguishes guest arrival (`CHECK_IN`) from manual or automatic completion.
- Automatic completion is expressly tied to `end_date`, proving that the reservation data model has an end-time boundary.

Timing implication:

- This is strong evidence that duration/end time matters to lifecycle and occupancy.
- It does **not** say how `end_date` is calculated, whether it is editable by the operator, or whether it must precede the restaurant’s closing time.

### 2. Widget integration

URL: https://docs.quandoo.com/widget-integration/

Exact callback/data field labels:

- `quantity`
- `date`
- `startTime`
- `endTime`
- `areaId`

Key short quotations:

- “Minimum recommended sizes” are width 300px and height 805px.
- “Embedding in Apps”
- “include some way ‘back’ after the reservation”

Findings:

- Reservation-complete data exposes both `startTime` and `endTime`.
- The widget is officially documented for embedding in iOS `WKWebView` and Android `WebView`.
- The public integration therefore treats reservation time as an interval, not merely a point-in-time start.

Timing implication:

- `startTime`/`endTime` supports duration-aware consumers and analytics.
- The page does not document slot-generation rules or prove an end-before-close constraint.

### 3. Reservation settings

URL: https://docs.quandoo.com/reservation-settings/

Exact labels:

- `Areas available for reservations`
- `Area selection required`
- `Capacities`
- `Online Reservation interval`
- `Automatic confirmation`

Key short quotations:

- “This value is used to display the time slots.”
- “If the interval set is 30 minutes”
- “12:00, 12:30 etc.”

Findings:

- Merchant settings expose bookable areas and area priority.
- If area selection is required, the guest must choose an available area.
- The online reservation interval controls the granularity of displayed **start-time slots**.

Timing implication:

- The public setting described here is a start-time interval, not a dining-duration control.
- No “last reservation,” “latest start,” “closing cutoff,” or “must finish by” helper text appears in the indexed page.

### 4. Check availability

URL: https://docs.quandoo.com/check-availability/

Exact endpoints:

- `GET /v1/merchants/{merchantId}/availabilities`
- `GET /v1/merchants/{merchantId}/availabilities/{date}/times`

Key short quotation:

- “available tables for the date, time and number of guests”

Findings:

- Availability is checked for date, time, and party size before reservation creation.
- The time endpoint returns available times for a date.
- The public summary does not expose an end-time or duration parameter.

Timing implication:

- Public clients should trust returned available starts rather than reconstruct availability from opening hours.
- Whether the backend incorporates duration/end-of-shift is undocumented here.

### 5. Official Android publisher listing

URL: https://play.google.com/store/apps/details?id=de.ecabo.android.booking.merchant

Publisher: Quandoo GmbH  
Updated: 2026-04-24

Exact feature wording/labels:

- “Quickly view and manage all your reservations”
- “guests are already seated or due to visit soon”
- “add walk-in guests”
- “create waiting lists”
- “table overview”
- “see availability”
- “calendar notes”
- “workload chart”
- “all or specific shifts”
- “guest notes and tags”

Findings:

- Current mobile functionality explicitly combines seated/upcoming reservations, walk-ins, waitlists, table availability, workload, and shift filtering.
- The listing gives operator-facing language for a live service view.
- No explicit reservation-duration editor, end-time label, last-start cutoff, or closing-time validation is mentioned.

### 6. Official Apple publisher listing

URL: https://apps.apple.com/gb/app/quandoo-restaurant-management/id1242241295

Publisher: Quandoo GmbH  
Compatibility shown: iOS/iPadOS 15.6 or later

Exact feature wording/labels:

- “Manage reservations with ease”
- “Manage your restaurant anytime, anywhere.”
- “Plan ahead with ease.”
- “real-time overview of all incoming reservations”
- “VIPs, large groups, overbookings and cancellations”
- “React immediately.”

Findings:

- The app is positioned as mobile operational oversight and intervention.
- The current description emphasizes incoming reservations and exceptions rather than duration/end-time configuration.

### 7. Apple version-history evidence for table assignment

URL: https://apps.apple.com/id/app/quandoo-restaurant-management/id1242241295?l=id&platform=ipad

Exact release labels:

- `ADD TABLES TO A RESERVATION`
- “add a specific table”
- “edit table selection”
- “single table or a table combination”

Findings:

- Mobile reservation creation and editing support explicit table assignment.
- Table combinations are a first-class assignment concept.
- Another release note says the app made it easier to understand the “exact time of a reservation.”

Timing implication:

- The mobile UX has historically exposed exact reservation time and table allocation.
- This still does not identify an editable duration/end-time control.

### 8. Official interactive table-plan product article

URL: https://restaurants.quandoo.com/en-nl/blog/how-to-design-an-efficient-restaurant-floor-plan

Published: 2025-08-01

Exact feature wording:

- `interactive table plan`
- “indoor and outdoor”
- “drag and drop reservations and walk-ins”
- “block tables”
- “create table combinations”
- “assign them on the go”
- “manage reservations and turn tables faster”

Findings:

- Quandoo configures seating areas to match the physical layout.
- The table plan supports dynamic table assignment, table blocking, combinations, reservations, and walk-ins.
- The product copy connects table-plan usage to faster table turns.

### 9. Official table-turnover article

URL: https://restaurants.quandoo.com/en-nl/blog/optimise-table-turnover-rate

Exact phase examples:

- `seated`
- `appetisers`
- `paid`

Key short quotation:

- “check the status of every table”

Findings:

- Operators can track table/service phases and manage seating expectations.
- This is operational occupancy-state evidence, not a documented duration-policy rule.

### 10. Official 2026 case study

URL: https://restaurants.quandoo.com/en-gb/blog/tatsu-case-study?hs_amp=true

Published: 2026-03-09

Key short quotation:

- “displays the restaurant’s floor plan”
- “corresponding tables and table numbers on a tablet”

Findings:

- The table plan is presented as a tablet-based live operational tool.
- It supports capacity optimisation and replaces handwritten reservation lists.

## After-close finish and cutoff analysis

### What official evidence supports

1. Reservations have both `startTime` and `endTime`.
2. Reservation completion logic can be based on `end_date`.
3. Availability is calculated in real time using restaurant setup, date/time, and party size.
4. Public clients receive available start times from Quandoo.
5. Operators manage seated/upcoming reservations, tables, walk-ins, waitlists, workload, and shifts.

### What official evidence does not establish

1. That a reservation is rejected when `endTime` exceeds the restaurant’s public closing time.
2. That closing time is interpreted as “last reservable start.”
3. That closing time is interpreted as “all diners must finish by.”
4. That an operator-facing duration field exists in the current mobile app.
5. That start and end cutoffs are independently configurable.
6. That the availability endpoint accepts duration or returns end time.

### Safest product-policy implication

Do not infer Quandoo’s closing-time semantics from the existence of `endTime`. The defensible model is:

- availability is authoritative for **which starts are bookable**;
- the reservation model separately carries an end boundary for occupancy/lifecycle;
- public sources are insufficient to decide whether after-close finishes are allowed.

For a comparable product, label start and end policies explicitly rather than overloading “closing time.” Useful settings would be:

- `Latest reservation start`
- `Default dining duration`
- `Guests must finish by closing time`
- `Allow reservations to finish after closing`

These suggested labels are design implications, not Quandoo quotations.

## Access and lifecycle caveats

- The current Quandoo for Restaurants landing pages state that Quandoo is closing down and most services remain available until 2026-09-30.
- The restaurant business website says it is “no longer active,” while the Android operator app was updated on 2026-04-24.
- Some documentation is approximately seven years old; it is primary evidence for the API model but may not describe the latest operator UI.
- No authenticated Business Center/restaurant account was available, so current in-product helper text and hidden settings could not be inspected.
- Search/page-opening infrastructure aborted several counter-searches. Direct retrieval also failed due the local escalation runtime stalling.

## CLAIMS

- CLAIM D1: Quandoo reservations are interval-shaped, with both start and end fields.  
  STATUS: supported.  
  PRIMARY: widget integration and API terminology.

- CLAIM D2: Quandoo uses reservation end time in lifecycle processing.  
  STATUS: supported.  
  PRIMARY: `AUTOMATIC_CHECK_OUT` after `end_date`.

- CLAIM D3: The operator mobile product supports live reservation/table availability, seated/upcoming guests, walk-ins, waitlists, workload, and shifts.  
  STATUS: supported.  
  PRIMARY: official Google Play publisher listing.

- CLAIM D4: Mobile/table-plan tooling supports assigning a single table or table combination and changing the assignment.  
  STATUS: supported.  
  PRIMARY: official Apple version history and official table-plan article.

- CLAIM D5: Quandoo prevents reservation end times from passing closing time.  
  STATUS: unresolved; no official public statement found.

- CLAIM D6: Quandoo treats closing time as the last bookable start.  
  STATUS: unresolved; no official public statement found.

- CLAIM D7: Current operator mobile UI exposes a duration/end-time editor.  
  STATUS: unresolved; no official public label or helper text found.

## EXPAND

- LEAD: authenticated Business Center/RMA settings — WHY: likely location of current duration, shift, and cutoff helper text — ANGLE: inspect a partner login or obtain a current operator manual/screenshots.
- LEAD: Interactive API schemas — WHY: may reveal `end_date`, duration, opening-hours, or availability response fields — ANGLE: inspect Swagger/OpenAPI on test and production docs.
- LEAD: app screenshots and release history across locales — WHY: screenshots may show exact table/time labels omitted from descriptions — ANGLE: fetch full-resolution official App Store/Play media and OCR.
- LEAD: current closure FAQ — WHY: could establish whether documentation/app functionality remains valid through 2026-09-30 — ANGLE: inspect official consumer closure page and service timeline.
- DEAD END: public indexed pages did not reveal a rule linking closing time to reservation end time.
