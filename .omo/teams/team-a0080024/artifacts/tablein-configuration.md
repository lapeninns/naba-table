# Tablein configuration evidence

Accessed 2026-07-16. Official Tablein sources only.

## Search log

Twenty distinct English queries were run:

1. `site:tablein.com "opening hours" reservations`
2. `site:tablein.com "online booking" "opening hours"`
3. `site:tablein.com intitle:"opening hours" restaurant booking`
4. `site:tablein.com inurl:help "last reservation"`
5. `site:tablein.com "booking length" table`
6. `site:tablein.com "reservation duration" party size`
7. `site:tablein.com "table turnover" reservations`
8. `site:tablein.com ("turn time" OR "turnover time") restaurant reservations`
9. `site:help.tablein.com "Opening hours" "last reservation"`
10. `site:help.tablein.com inurl:opening-hours availability`
11. `site:help.tablein.com "custom periods" opening hours`
12. `site:help.tablein.com "closing time" "booking length"`
13. `site:help.tablein.com "last available reservation"`
14. `site:tablein.com "last reservation" "closing time"`
15. `site:tablein.com "when to stop" online reservations`
16. `site:help.tablein.com ("end time" OR "service time") reservation duration`
17. `site:help.tablein.com "Minimum Turnover"`
18. `site:help.tablein.com "Default Duration" "Minimum Duration"`
19. `site:help.tablein.com "Duration by Party Size"`
20. `site:help.tablein.com intitle:"Reservation duration"`

## Conclusion

Tablein's current official help documentation is explicit: the configured opening-hours end is the restaurant's actual closing/service-finish time, not the last reservable start. The system subtracts the applicable reservation duration to calculate the last start. Example: a 23:00 close with a two-hour duration produces a 21:00 last reservation.

## Primary sources

1. **How to Set Up Opening Hours**  
   URL: https://help.tablein.com/et-up-opening-hours  
   Displayed publication date: none. Search index said crawled last month.  
   Quotes:
   - “The end time should be your restaurant’s actual closing time, not the last reservation time.”
   - “The system automatically calculates the last available reservation based on your reservation duration settings.”
   - “If duration = 2 hours, closing time = 23:00 → Last available reservation will be at 21:00.”
   Reliability: **Very high** — current first-party configuration guide; directly answers the semantic question.

2. **Tablein onboarding**  
   URL: https://www.tablein.com/onboarding  
   Displayed publication date: none. Search index said crawled yesterday.  
   Quotes:
   - “The last available reservation times are determined by the table booking length.”
   - “If you want the last reservation at 9 p.m., set the closing time to 11 p.m.”
   Reliability: **Very high** — first-party operational onboarding independently repeats the rule.

3. **Get started with Tablein**  
   URL: https://help.tablein.com/get-started  
   Displayed publication date: none. Search index said crawled three weeks ago.  
   Quotes:
   - “Each dining area can have its own opening hours and online booking settings.”
   - “Service Time (Optional): Set different turnover times for specific days or hours.”
   - “If bookings are 2 hours long...set closing time to 11 p.m.”
   Reliability: **High** — current first-party setup overview; notes the product is mid-migration between UI versions.

4. **Reservation duration**  
   URL: https://help.tablein.com/v3-version-reservation-duration  
   Displayed publication date: none. Search index said crawled last month.  
   Quotes:
   - “The system automatically adjusts how long a table is booked based on the number of guests.”
   - “1–4 Guests: 2 hours”
   - “5–6 Guests: 2.5 hours”
   - “7+ Guests: 3 hours”
   - “If a full 2-hour slot isn't available online, the system will offer the 1.5-hour slot.”
   Reliability: **Very high** — current first-party help page describing party-size duration and flexible minimum duration.

5. **Custom opening hours**  
   URL: https://help.tablein.com/custom-opening-hours  
   Displayed publication date: none. Search index said crawled three weeks ago.  
   Quotes:
   - “Overwrite regular hours for one date or a short period.”
   - “Adjust online availability for specific dates, such as blocking certain time slots.”
   - “One custom period per date.”
   Reliability: **Very high** — current first-party procedural help.

6. **Product Tour**  
   URL: https://www.tablein.com/product-tour  
   Displayed publication date: none. Search index said crawled last week.  
   Quotes:
   - “Increase the guest capacity by controlling turnover time for each individual table.”
   - “Control reservation times for each restaurant dining area individually.”
   - “Stagger your load by accepting table reservations every 15 or 30 minutes.”
   Reliability: **High** — first-party product description, less precise than procedural help.

7. **How Does an Online Restaurant Booking System Work?**  
   URL: https://www.tablein.com/blog/restaurant-booking-system-process  
   Published: 2023-05-25.  
   Quotes:
   - “The online reservation setup...guides the booking system on when to start taking reservations and when to stop.”
   - “You can customize these timings for each day...and different dining areas.”
   Reliability: **Medium** — first-party explanatory blog, older and initially ambiguous about “stop”; current help resolves the ambiguity.

8. **How to Set Up Your Restaurant Booking System**  
   URL: https://www.tablein.com/blog/restaurant-booking-system-setup  
   Published: 2023-07-21.  
   Quotes:
   - “Entering your opening and closing times into the software.”
   - “Tablein lets you set a custom date or period.”
   Reliability: **Medium** — first-party overview, useful corroboration but not definitive semantics.

9. **Widget settings**  
   URL: https://help.tablein.com/widget-settings  
   Displayed publication date: none. Search index said crawled last month.  
   Quotes:
   - “A list of available time slots based on your opening hours and availability.”
   - “How many minutes before arrival can you accept...reservations.”
   Reliability: **High** — current help; confirms separate booking cut-offs and slot visibility.

10. **Tablein changelog**  
    URL: https://www.tablein.com/changelog  
    Relevant update: 2025-06-03.  
    Quote:
    - “Guests will only see options that match your table availability and party size.”
    Reliability: **High** — dated first-party product-change record.

## Terminology

- **Opening hours / start time / end time / closing time**: service-operating bounds. Current help says the end is actual closing.
- **Last available reservation / last reservation**: latest permissible reservation start after duration is subtracted.
- **Reservation duration / default duration / booking length / turnover time / service time**: occupied interval used to calculate end time and future availability.
- **Minimum duration / minimum turnover / minimum online time**: shorter fallback interval offered when the default duration does not fit.
- **Online availability / blocked time slots**: per-area/per-slot visibility controls inside opening hours.
- **Custom opening hours / custom date or period**: temporary override of recurring hours.
- **Last-minute setting / minutes before arrival**: lead-time cutoff, distinct from daily service end.

## Contradictions and dead ends

- The 2023 process blog says online setup controls when reservations “start” and “stop,” which could be misread as latest start. Current procedural help explicitly rejects that interpretation: end time is actual closing.
- Marketing language sometimes calls duration “turnover time,” while help pages distinguish default/minimum duration and service-time exceptions. Treat these as duration rules, not an independent closing cutoff.
- Four counter-searches for exact phrases around “last reservation,” “closing time,” and “end time” returned no additional results.
- Restaurant-hosted `*.tablein.com` pages display public opening hours but do not prove administrator configuration semantics, so they were excluded from the core conclusion.

## Operator-policy implications

- Store a service interval whose end means **guest/table occupancy must finish**, not the last seating.
- Derive `last_start = service_end - applicable_duration`, using party size and active day/hour duration rule.
- If a shorter minimum duration is allowed, late slots may use that shorter end-to-end occupancy only with explicit guest disclosure.
- Model recurring service hours separately from online slot blocks, custom-date overrides, and lead-time cutoffs.
- Scope schedules and duration rules by dining area; do not assume one restaurant-wide calendar.
- Reject or flag existing reservations whose end falls outside newly shortened opening hours.

## CLAIMS

- CLAIM: Tablein opening-hours end is actual closing/service finish, not last reservable start. — RISK: normal — PRIMARY: current Tablein opening-hours help — STATUS: supported.
- CLAIM: The latest start is calculated by subtracting the applicable reservation duration from closing time. — RISK: normal — PRIMARY: help guide plus onboarding — STATUS: supported.
- CLAIM: Reservation duration can vary by party size and day/hour, with a shorter minimum fallback. — RISK: normal — PRIMARY: reservation-duration help — STATUS: supported.
- CLAIM: Online availability blocks and custom periods are separate overlays on opening hours. — RISK: normal — PRIMARY: opening-hours and custom-hours help — STATUS: supported.

## EXPAND

none — lead instructed retrieval to stop; decisive semantics are explicitly documented by current primary sources.
