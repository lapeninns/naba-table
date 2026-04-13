# Validation Contract

## Area: Bookings Hub

### VAL-HUB-001: Bookings hub presents the canonical guest booking entry shell

The `/bookings` page renders inside the guest shell and shows the current observable source-of-truth copy: `Bookings`, `Your Reservations`, `Book a new table or manage existing reservations.`, and a single `Booking actions` region.
Tool: agent-browser
Evidence: screenshot(mobile), screenshot(desktop), visible-text(`Bookings`), visible-text(`Your Reservations`), visible-text(`Book a new table or manage existing reservations.`), visible-region(`Booking actions`)

### VAL-HUB-002: Book-a-table card keeps its current content and restaurant-discovery destination

The `Book a table` card keeps its current heading, supporting text, and `Browse restaurants` CTA label, and its primary CTA sends the guest to `/restaurants`.
Tool: agent-browser
Evidence: screenshot(card), visible-text(`Book a table`), visible-text(`Find a restaurant, pick a date and time, and confirm your reservation.`), visible-action(`Browse restaurants`), current-url after click to `/restaurants`

### VAL-HUB-003: Manage-bookings card keeps both self-service entry points visible

The `Manage bookings` card keeps its current heading and supporting text and shows both `View my bookings` and `Sign in` CTAs at the same time.
Tool: agent-browser
Evidence: screenshot(card), visible-text(`Manage bookings`), visible-text(`Sign in to see your upcoming and past bookings, or make changes where available.`), visible-actions(`View my bookings`,`Sign in`)

### VAL-HUB-004: Signed-out self-service entry falls through to guest auth

From `/bookings`, a signed-out click on `View my bookings` redirects to `/auth/signin?redirectedFrom=/guest/bookings`.
Tool: agent-browser
Evidence: current-url after click, screenshot(sign-in destination)

### VAL-HUB-005: Signed-in self-service entry lands on the guest bookings list

From `/bookings`, an authenticated click on `View my bookings` lands on `/guest/bookings` without an intermediate auth bounce.
Tool: agent-browser
Evidence: current-url after click, screenshot(guest bookings list)

### VAL-HUB-006: Hub actions remain mobile-first and easy to tap

On a mobile viewport, the two cards stack vertically, all three visible CTAs remain full-width, tap-friendly, and unclipped, and the page does not introduce horizontal scrolling.
Tool: agent-browser
Evidence: screenshot(mobile), element-bounds for CTA buttons, no-horizontal-scroll observation

### VAL-HUB-007: Direct hub sign-in preserves the bookings return target

From `/bookings`, clicking `Sign in` navigates to `/auth/signin?redirectedFrom=/bookings`.
Tool: agent-browser
Evidence: current-url after click, screenshot(sign-in destination)

## Area: Restaurant Booking Flow

### VAL-FLOW-001: Restaurant booking route resolves to a venue-scoped wizard

Opening `/restaurants/[slug]/book` for a valid restaurant shows the booking wizard with the selected restaurant context; an unknown slug resolves to the route's not-found behavior instead of a broken or generic booking screen.
Tool: agent-browser
Evidence: screenshot(valid slug), visible restaurant identity, screenshot(not-found path or state)

### VAL-FLOW-002: Plan step blocks progression until a real booking plan is complete

The booking flow exposes the guest journey in the order Plan, Details, Review, Confirmation, and guests cannot leave Plan until date, party size, and an enabled time selection are complete for a bookable slot.
Tool: agent-browser
Evidence: screenshot(stepper), disabled/enabled primary action states, current step labels

### VAL-FLOW-003: Details step enforces current guest contact rules before review

Guests cannot leave Details until valid name, email, UK phone number, and accepted terms are provided, and invalid data is presented as guest-safe inline validation rather than raw schema/system errors.
Tool: agent-browser
Evidence: screenshot(details step invalid state), screenshot(details step valid state), visible validation messages

### VAL-FLOW-004: Mobile wizard navigation stays sticky and one-hand reachable

On mobile, the booking wizard keeps the step progress and current primary navigation action reachable near the bottom of the viewport without covering interactive content or clipping controls.
Tool: agent-browser
Evidence: screenshot(mobile plan step), screenshot(mobile details/review step), observed sticky bottom navigation

### VAL-FLOW-005: Review step mirrors entered booking data and supports safe edits

The Review step shows the restaurant, date, time, party size, contact details, and guest notes entered earlier, and using Back or Edit returns to earlier steps without clearing already-entered valid data.
Tool: agent-browser
Evidence: screenshot(review), observed preserved field values after back/edit

### VAL-FLOW-006: Submit outcomes stay guest-safe across confirmation and recovery states

Submitting a booking never exposes raw API/system errors: success states show one of the implemented headings (`Booking confirmed`, `Booking updated`, or `Booking pending`) with the booking essentials preserved, and duplicate/offline/timeout recovery paths use guest-safe copy and return the guest to a recoverable flow state.
Tool: agent-browser
Evidence: screenshot(confirmation state), screenshot(error/recovery state), visible status heading, visible guest-safe recovery copy

## Area: Confirmation and Thank-You

### VAL-CONFIRM-001: In-flow confirmation keeps the booking essentials visible before exit

After `Confirm booking` in `/restaurants/[slug]/book`, the confirmation step shows the current booking status heading, booking reference, guest name, date, time, party size, and only guest-safe follow-up copy/actions for that state.
Tool: agent-browser
Evidence: screenshot(confirmation), visible status heading, visible booking summary facts

### VAL-CONFIRM-002: Restaurant thank-you canonical route keeps the exact lightweight confirmation experience

`/restaurants/[slug]/book/thank-you` renders the existing public confirmation card with `Reservation confirmed!`, `Confirmation email sent with your details and link.`, and the `View my bookings` and `Explore restaurants` exits.
Tool: agent-browser
Evidence: screenshot(mobile), screenshot(desktop), visible-text(`Reservation confirmed!`), visible-text(`Confirmation email sent with your details and link.`), visible-actions(`View my bookings`,`Explore restaurants`)

### VAL-CONFIRM-003: Restaurant thank-you legacy route redirects to the canonical thank-you page

`/restaurants/[slug]/thank-you` redirects to `/restaurants/[slug]/book/thank-you` and lands on the same canonical thank-you experience rather than rendering a separate page.
Tool: agent-browser
Evidence: current-url after navigation, screenshot(canonical destination)

### VAL-CONFIRM-004: Legacy public thank-you links funnel into the guest receipt destination

`/bookings/[bookingId]/thank-you` redirects to `/guest/bookings/[bookingId]/receipt`, preserves incoming query parameters, and does not terminate on a separate public thank-you screen.
Tool: agent-browser
Evidence: current-url after navigation, preserved query string, screenshot(receipt destination)

### VAL-CONFIRM-005: Guest receipt access rules distinguish signed-in and token-based entry

`/guest/bookings/[bookingId]/receipt` loads for a signed-in guest or a valid tokenized entry and otherwise redirects to `/auth/signin?redirectedFrom=/guest/bookings/[bookingId]/receipt`.
Tool: agent-browser
Evidence: current-url for signed-in path, current-url for signed-out redirect, current-url for tokenized path

### VAL-CONFIRM-006: Token-only receipt entry prompts the guest to sign in for faster management

When the receipt is opened through a tokenized path without an authenticated guest session, the receipt still renders and shows the inline prompt `Sign in to manage bookings faster.` linking to `/auth/signin?redirectedFrom=/guest/bookings/[bookingId]`.
Tool: agent-browser
Evidence: screenshot(token receipt state), visible-text(`Sign in to manage bookings faster.`), sign-in link target

### VAL-CONFIRM-007: Guest receipt is the canonical detailed confirmation surface

`/guest/bookings/[bookingId]/receipt` shows the booking summary shell with venue identity, status, booking reference, date/time/party information, guest details, confirmation-email guidance, and the receipt action set (`Calendar`, `PDF`, `Share`) in a layout that stays readable across mobile and desktop.
Tool: agent-browser
Evidence: screenshot(mobile), screenshot(desktop), visible summary facts, visible-text(confirmation guidance), visible actions(`Calendar`,`PDF`,`Share`)

### VAL-CONFIRM-008: Top-level thank-you alias preserves the receipt redirect chain

Opening `/thank-you?bookingId=...` resolves through the booking thank-you alias chain into `/guest/bookings/[bookingId]/receipt` without dropping query parameters.
Tool: agent-browser
Evidence: current-url chain, preserved query string, screenshot(receipt destination)

### VAL-CONFIRM-009: Receipt load failures stay guest-safe

If receipt access succeeds but the booking data cannot be loaded, `/guest/bookings/[bookingId]/receipt` shows the current guest-safe fallback message and the `View my bookings` exit instead of exposing a raw error.
Tool: agent-browser
Evidence: screenshot(receipt error state), visible guest-safe fallback copy, visible-action(`View my bookings`)

## Area: Booking Detail and Recovery

### VAL-DETAIL-001: Public booking detail preserves the recovery-link handoff

Opening `/bookings/[bookingId]?access_token=...` passes through `/bookings/recover`, lands on the canonical public detail page with the booking content available, and does not leave the access token in the final URL.
Tool: agent-browser
Evidence: current-url before and after recovery handoff, screenshot(detail page), observation(token absent from final URL)

### VAL-DETAIL-002: Public detail sends unsigned guests to guest auth with the canonical return target

Without a signed-in guest session or valid recovery access, `/bookings/[bookingId]` redirects to `/auth/signin?redirectedFrom=/bookings/[bookingId]`.
Tool: agent-browser
Evidence: current-url after redirect, screenshot(sign-in destination)

### VAL-DETAIL-003: Public manage alias resolves to canonical booking detail

`/bookings/[bookingId]/manage` redirects to `/bookings/[bookingId]`, preserves query parameters, and ends on the same public booking-detail experience.
Tool: agent-browser
Evidence: current-url after redirect, preserved query string, screenshot(canonical detail)

### VAL-DETAIL-004: Guest detail sends unsigned guests to auth while preserving the guest return path

Without an authenticated guest session, `/guest/bookings/[bookingId]` redirects to `/auth/signin?redirectedFrom=/guest/bookings/[bookingId]`.
Tool: agent-browser
Evidence: current-url after redirect, screenshot(sign-in destination)

### VAL-DETAIL-005: Legacy detail token links fail through the deprecated recovery path

Opening `/bookings/[bookingId]?token=...` does not load booking detail; it lands on the recovery-error flow with the legacy-token-deprecated guidance instead.
Tool: agent-browser
Evidence: current-url after redirect, screenshot(recovery error state), visible deprecated-token guidance

### VAL-DETAIL-006: Recovery route maps invalid token states to safe destinations and sanitizes `next`

`/bookings/recover` sends missing, invalid, expired, or unsupported token states to their current recovery-error destinations, and an invalid external `next` target collapses to an internal-safe destination instead of escaping the site.
Tool: agent-browser
Evidence: current-url for representative error cases, current-url for invalid `next`, screenshot(recovery error)

### VAL-DETAIL-007: Public and guest detail surfaces keep a shared summary-and-actions pattern

`/bookings/[bookingId]` and `/guest/bookings/[bookingId]` render the same booking-detail shell pattern, and on mobile the summary and action hierarchy remain stable, including the summary actions plus the ordered manage actions `Modify Details`, `Cancel Booking`, and `Book Again` when present.
Tool: agent-browser
Evidence: screenshot(public detail), screenshot(guest detail), screenshot(mobile detail), visible shared action labels

### VAL-DETAIL-008: Recovery error page shows code-specific guidance with only the current exit options

`/bookings/recover/error?code=...` displays the current matching recovery error title/body, unknown codes fall back to the invalid-link guidance, and the page only offers `Sign in` and `Return home` as recovery exits.
Tool: agent-browser
Evidence: screenshot(error state), visible-text for selected code, visible-actions(`Sign in`,`Return home`)

### VAL-DETAIL-009: Degraded recovery sessions fail into the shared guest-safe detail error state

If `/bookings/[bookingId]` admits a recovery session via cookie presence but the booking fetch is later rejected, the page shows the shared guest-safe detail error state with retry and dashboard exit actions rather than a broken detail shell or raw recovery error.
Tool: agent-browser
Evidence: screenshot(detail error state), visible retry action, visible dashboard exit action

## Cross-Area Flows

### VAL-CROSS-001: Bookings hub and restaurant booking route keep objective guest-booking continuity

Starting at `/bookings`, navigating to restaurant discovery, and opening `/restaurants/[slug]/book` preserves the guest-booking system through consistent shell chrome, card treatment, and prominent primary-CTA behavior rather than switching to a route-specific interaction model.
Tool: agent-browser
Evidence: screenshot(`/bookings`), screenshot(`/restaurants/[slug]/book`), observed shared shell/card/button language

### VAL-CROSS-002: Confirmation exits flow into the canonical receipt journey when booking identity exists

Leaving a successful booking confirmation through its implemented thank-you/return path reaches the canonical receipt journey for that booking rather than dropping the guest onto an unrelated screen.
Tool: agent-browser
Evidence: current-url chain from confirmation exit, screenshot(receipt destination or safe fallback)

### VAL-CROSS-003: Booking detail preserves rebook continuity back into the venue wizard

Using `Book Again` from a booking-detail destination returns the guest to the correct restaurant booking flow when a restaurant slug exists, with rebook context preserved in the URL.
Tool: agent-browser
Evidence: current-url after rebook action, screenshot(destination wizard)

### VAL-CROSS-004: Redirect-only aliases behave as checkpoints, not separate experiences

The legacy alias routes in scope (`/restaurants/[slug]/thank-you`, `/bookings/[bookingId]/manage`, `/bookings/[bookingId]/thank-you`) redirect to their canonical destinations, preserve query continuity where implemented, and do not expose standalone route-specific UI.
Tool: agent-browser
Evidence: current-url after each alias visit, preserved query string, screenshot(destination for each alias)

### VAL-CROSS-005: Thank-you, receipt, and detail destinations preserve mobile-first continuity

Moving between thank-you, receipt, and booking-detail destinations keeps a consistent summary hierarchy, back/navigation affordances, and primary-action placement on mobile.
Tool: agent-browser
Evidence: screenshot(mobile thank-you), screenshot(mobile receipt), screenshot(mobile detail), observed action placement comparison
