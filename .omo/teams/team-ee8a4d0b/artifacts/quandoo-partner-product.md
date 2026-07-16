# Quandoo partner/business product timing research

Role: member B, partner-product  
Access date for every URL: 2026-07-16  
Source policy: official Quandoo-controlled primary sources only

## Outcome

Public Quandoo partner material models at least two separate concepts:

1. **Reservation/opening-hour configuration** controls when selectable reservation times are offered.
2. **Dining Duration** controls the default amount of time a booking occupies a table.

The strongest public evidence therefore supports interpreting the final displayed reservation time as a **reservation start-slot cutoff**, not as a label for the end of dining. However, no public partner page found states whether Quandoo automatically removes a start slot when its Dining Duration would extend beyond opening/closing time. That crossing-closing rule remains undocumented and may be visible only inside the authenticated Business Center/Pro product.

## Successful official-source query log

These 12 distinct queries were run in three waves. Every query was restricted to the official `restaurants.quandoo.com` domain.

1. `site:restaurants.quandoo.com reservation hours duration closing restaurant partner`
2. `site:restaurants.quandoo.com "opening hours" reservations`
3. `site:restaurants.quandoo.com "reservation duration" OR "booking duration"`
4. `site:restaurants.quandoo.com table turnover OR table turns`
5. `site:restaurants.quandoo.com filetype:pdf reservation management guide`
6. `site:restaurants.quandoo.com/hubfs PDF "opening hours" Quandoo`
7. `site:restaurants.quandoo.com/hubfs PDF "reservation" "duration"`
8. `site:restaurants.quandoo.com blog reservation time slots restaurant closing`
9. `site:restaurants.quandoo.com/en-gb/solutions "reservation hours"`
10. `site:restaurants.quandoo.com/en-gb/solutions "opening hours"`
11. `site:restaurants.quandoo.com/en-gb/blog "Dining Duration"`
12. `site:restaurants.quandoo.com "last reservation" Quandoo`

Full pages were fetched for the material sources below. The final four queries were a counter-search and returned no results.

## Primary evidence

### 1. Dining Duration is a table-occupancy setting

Source: [How to Overcome 6 Common Restaurant Reservation Challenges](https://restaurants.quandoo.com/en-nl/blog/restaurant-reservation-challenges)

Exact public product wording:

- “set how long each booking can last”
- Label: **“Dining Duration”**
- “default amount of time guests can occupy a table”

The page says this value can be based on restaurant capacity and peak times and links it to booking limits and efficient table turns. This is the clearest official definition of the duration setting.

### 2. Reservation hours and opening hours are separately named

Source: [6 Benefits of Pro](https://restaurants.quandoo.com/en-sg/blog/6-benefits-of-pro-reservation-system)

Exact wording:

- “set your own reservation and opening hours”

The page places this under capacity and availability controls used to manage peak hours and reduce waits. The conjunction distinguishes reservation hours from opening hours rather than treating them as one field.

### 3. Consumer-facing availability is expressed as selectable time slots

Source: [Online Restaurant Reservations](https://restaurants.quandoo.com/en-nz/solutions/online-restaurant-reservations)

Exact labels/text:

- “Let guests know when you’re open for business”
- “24/7 real-time table availability”
- Image alternative text: “A time slot representing the desired reservation time is selected.”

The desired reservation time is presented as a slot selected by a guest. In normal reservation-product usage this is the arrival/start time. The page does not describe this slot as a dining end time.

### 4. Contract terms recognize a reservation period with an end

Source: [Quandoo Terms & Conditions for Corporate Partners](https://restaurants.quandoo.com/en-gb/terms-and-conditions)

Exact wording:

- “end of the reservation period”
- “online dialogues of your User Account”
- “Support, installation, maintenance and training will only be given if agreed”

The cancellation-fee workflow runs 72 hours after the end of the reservation period. This independently confirms that a reservation has a modeled period/end, but the public terms do not define how that end interacts with closing time. The terms also say product scope is determined in authenticated User Account dialogues, explaining why precise helper text may not be publicly indexed.

### 5. Quandoo defines table turnover through occupancy time

Source: [5 Tactics to Optimise Your Restaurant's Table Turnover Rate](https://restaurants.quandoo.com/en-nl/blog/optimise-table-turnover-rate)

Exact wording:

- “the amount of time a party occupies a table”
- “check the status of every table”
- “manage seating expectations”

This is consistent with Dining Duration being an occupancy interval after a reservation begins.

### 6. Current lifecycle caveat

Source: [Quandoo for Restaurants Singapore](https://restaurants.quandoo.com/en-sg/)

Exact wording:

- “Quandoo is closing down.”
- “majority of our services remain available”
- “until 30 September 2026”

These pages are current primary material during a phased wind-down. They should be treated as evidence of the live product’s documented semantics as accessed, not as a long-term roadmap.

## Start-cutoff versus end-shift assessment

### Best-supported interpretation

**Start cutoff.** The product exposes a guest-selectable reservation time slot, separately names reservation hours/opening hours, and applies Dining Duration as the length of table occupancy. Thus a final displayed reservation time is best read as the latest allowed reservation **start**.

### What cannot be established publicly

No located official public page says any of the following:

- a booking may finish after the restaurant’s opening-hours close;
- a booking must finish by closing;
- latest start equals closing minus Dining Duration;
- reservation hours are automatically shortened based on Dining Duration;
- opening hours are merely informational and never constrain availability.

Therefore the stronger statement “Quandoo always permits a duration to extend after close” is unsupported. So is the opposite universal statement “Quandoo always enforces end by close.”

## Counter-search and negative evidence

The query set expressly included:

- `"last reservation"`
- `"reservation duration" OR "booking duration"`
- reservation time slots plus closing
- reservation hours plus opening hours
- PDF/manual searches for duration and opening hours

No official public result described a “last booking” field, a closing-minus-duration formula, an end-of-shift rule, or after-close completion. Search results did expose HubSpot-hosted official promotional-calendar PDFs, but those concerned marketing offers and not reservation timing configuration.

## Barriers and gaps

- Precise configuration dialogs appear to live in the authenticated User Account/Business Center/Pro interface.
- The public terms explicitly defer product detail to “online dialogues of your User Account.”
- Direct sitemap and raw PDF retrieval could not be completed: the static web fetcher aborted, and direct network access approval timed out twice.
- Linked screenshots on the Dining Duration article were exposed only as image references/alternative text, not readable full-resolution UI in the available fetch surface.
- No public operator manual or training PDF defining closing-time interaction was found.

## CLAIMS

- CLAIM: Quandoo publicly names an operator control “Dining Duration.” — RISK: normal — SOURCES: restaurants.quandoo.com — COUNTER: duration/manual queries found no competing label — PRIMARY: official Quandoo partner blog.
- CLAIM: Dining Duration is the default time guests occupy a table. — RISK: normal — SOURCES: restaurants.quandoo.com — COUNTER: no official contradiction found — PRIMARY: official Quandoo partner blog.
- CLAIM: Pro separately names reservation hours and opening hours. — RISK: normal — SOURCES: restaurants.quandoo.com — COUNTER: no official source merged the two concepts — PRIMARY: official Quandoo Pro product article.
- CLAIM: The last displayed reservation time is more strongly supported as a start-slot cutoff than as a dining-end label. — RISK: high — SOURCES: restaurants.quandoo.com — COUNTER: no official end-shift formula found — PRIMARY: official product pages; STATUS: partial because crossing-closing behavior is undocumented.
- CLAIM: Public evidence does not establish whether Dining Duration may cross closing time. — RISK: normal — SOURCES: restaurants.quandoo.com — COUNTER: explicit closing/last-reservation/manual searches returned no rule — PRIMARY: official partner corpus searched.

## EXPAND

- LEAD: authenticated Business Center/Pro settings — WHY: public terms say online User Account dialogues define product scope; likely location of precise helper text — ANGLE: signed-in operator account, training recording, or customer-provided screenshot.
- LEAD: full-resolution `restaurant-reservation-challenges-dining-duration` image asset — WHY: may show field labels, units, options, and surrounding hours controls — ANGLE: retrieve page HTML/HubSpot asset URL or inspect through a working interactive browser.
- LEAD: Quandoo support/training video channels — WHY: screen recordings may demonstrate reservation hours and Dining Duration together — ANGLE: official Quandoo YouTube/Vimeo and webinar pages, including localized titles.
- DEAD END: public promotional-calendar PDFs — marketing-offer timing only; no reservation duration/closing semantics.
- DEAD END: public English partner pages for “last reservation” — no indexed official result.
