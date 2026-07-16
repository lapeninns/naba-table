# Terminology-skeptic: reservation/service end semantics

Accessed 2026-07-16. Scope stopped by team lead after the initial 16-query English sweep.

## Bottom line

The collected primary evidence does not support a universal interpretation of a reservation-system “end time.”

- Tablein explicitly defines opening-hours `end time` as the restaurant’s actual closing/occupancy boundary; the last bookable reservation is calculated by subtracting reservation duration.
- Hostme describes online-reservation start/end hours as the slots visible online, while a separate table-turnover duration models occupancy. Its documentation does not state clearly whether the final displayed slot must finish before the configured reservation-hours end.
- Resy’s first-party editorial example calls 9 p.m. the “last seating” while the restaurant is open until 10 p.m.; therefore “last seating” is plainly a booking/arrival time, not departure.
- Tock’s first-party editorial material distinguishes a reservation’s “designated end time” from service hours, supporting an expected-departure concept at the individual-reservation level.
- Toast’s public product page discusses active covers and time since seating, but does not define service/reservation end semantics.

Operator policy should therefore use separate fields for (1) first seating, (2) last seating/bookable start, (3) expected duration/turn time, and (4) hard venue/area close. Never map a vendor field called merely `end` without vendor-specific semantics.

## Terminology and reliability matrix

| Vendor | Primary evidence | Term(s) | Supported meaning | Reliability | Contradiction / limitation |
|---|---|---|---|---|---|
| Tablein | https://help.tablein.com/et-up-opening-hours | “end time”; “actual closing time”; “last available reservation” | End is actual close; last booking = close minus duration | A: official configuration guide, direct and worked example | Contradicts any cross-platform assumption that `end` always means last seating |
| Tablein | https://www.tablein.com/onboarding | “closing time”; “last reservation”; “booking length” | To get 9 p.m. last reservation with 2-hour duration, close at 11 p.m. | A-: official onboarding, explicit example | Same semantic, but public marketing/onboarding rather than help specification |
| Hostme | https://help.hostmeapp.com/en/articles/4474637-how-to-set-up-online-reservation-hours | “start and end of service”; visible online slots | End appears to bound online slot visibility | B+: official help, direct UI instruction | Does not explicitly say whether duration may extend past end |
| Hostme | https://help.hostmeapp.com/en/articles/12638846-how-to-adjust-table-turnover-duration | “Table Turnover (Duration)” | Separate duration per party size/reservation | A-: official help, direct setting definition | Relationship to reservation-hours end remains undocumented in collected page |
| Hostme | https://help.hostmeapp.com/en/articles/4473275-understand-cover-pacing | “time slot”; “default table turnover”; “at the same time” | Slots are booking starts; turnover drives overlap/capacity | A-: official help, operational examples | Supports separation of slot boundary and occupancy, but not last-slot calculation |
| Hostme | https://help.hostmeapp.com/en/articles/6407112-table-hold-time | “turnover time”; party “will stay for two hours” | Turnover is an assumed stay/occupancy duration | A-: official help, explicit example | This feature says it does not affect online timeslot availability |
| Resy | https://blog.resy.com/2023/01/how-to-get-into-semma/ | “9, the last seating”; “open … 5 to 10 p.m.” | Last seating is arrival/start, not final departure | B+: first-party editorial interview with restaurant operator; concrete times | Not a Resy configuration specification |
| Tock | https://www.exploretock.com/join/resources/5-dining-trends-that-defined-2025/ | “designated end time to a reservation” | Individual reservation may carry an expected departure/turn boundary | B: first-party editorial/marketing content | Does not define Tock service-hours configuration |
| Toast | https://pos.toasttab.com/products/toast-tables | “time since last seating”; “active covers” | Product tracks seating and current occupancy separately | B: official product page | No definition of reservation-hours end, last booking, or duration boundary |

## Short primary quotes

- Tablein help: “actual closing time, not the last reservation time.”
- Tablein help: “duration = 2 hours, closing time = 23:00”
- Tablein onboarding: “last available reservation times are determined by the table booking length.”
- Hostme hours: “reflect start and end of service”
- Hostme pacing: “total number of guests at the restaurant at the same time”
- Hostme turnover: “Set table duration for each party size”
- Hostme hold time: “they will stay for two hours”
- Resy/Semma: “9, the last seating”
- Resy/Semma: “open Tuesdays to Sundays from 5 to 10 p.m.”
- Tock: “communicating a designated end time to a reservation”
- Toast: “time since last seating, total covers, and active covers.”

## Contradictions and semantic hazards

1. **`End time` is not portable.** Tablein’s opening-hours end is a close/departure ceiling, while Hostme’s reservation-hours end is described as the end of the visible online service block.
2. **`Last seating` is not close.** Resy’s Semma example separates a 9 p.m. last seating from a 10 p.m. venue close.
3. **`Reservation end` is not service end.** Tock’s editorial wording applies an end time to an individual reservation, enabling a table turn.
4. **`Turnover` is modeled occupancy, not necessarily enforced departure.** Hostme says the system assumes a party will stay for the configured duration; it also allows host overrides.
5. **`Cutoff time` may mean booking-channel cutoff, not seating cutoff.** Hostme’s cutoff documentation concerns when same-day reservations stop being accepted, not when guests may be seated.

## Dead ends / unresolved access

- Tock operator help/configuration pages were not surfaced by the two official-domain searches; public results were editorial or venue pages.
- OpenTable Restaurant Solutions and support searches returned no relevant configuration page.
- Resy Helpdesk search returned no operator configuration page; only first-party editorial material surfaced.
- SevenRooms official-domain searches returned no relevant result.
- Toast Central search returned no relevant help article; only the public product page surfaced.
- TheFork Manager, Quandoo, and Eat App official-help searches returned no relevant result.
- No login-only page was opened during the stopped pass; the absence of public results must not be treated as evidence of product behavior.

## Query log (16 distinct English queries)

1. `site:exploretock.com/join/tock-how-to "end time" reservation service hours`
2. `site:help.exploretock.com "reservation duration" OR "service hours" OR "last seating"`
3. `site:help.tablein.com "last reservation" opening hours booking period`
4. `site:tablein.com "reservation duration" "opening hours" restaurant`
5. `site:opentable.com/restaurant-solutions/resources "shift" "end time" reservations`
6. `site:support.opentable.com "last seating" OR "turn time" reservation`
7. `site:helpdesk.resy.com "shift end" reservation duration`
8. `site:blog.resy.com "turn time" "reservation" restaurant`
9. `site:sevenrooms.com/en/blog "reservation duration" OR "turn time"`
10. `site:sevenrooms.com "shift end" reservations restaurant`
11. `site:central.toasttab.com "reservation hours" "turn times" Toast Tables`
12. `site:pos.toasttab.com/blog "last seating" reservation duration`
13. `site:support.theforkmanager.com "service end" reservation hours`
14. `site:help.quandoo.com "last booking" restaurant opening hours`
15. `site:help.hostmeapp.com reservation duration business hours`
16. `site:restaurant.eatapp.co/help "last reservation" OR "shift end"`

## Operator-policy implications

- Store `last_seating_at` and `hard_close_at` separately.
- Compute expected departure as `seating_at + duration`, but preserve it as a forecast/policy boundary rather than claiming actual guest departure.
- Require every channel adapter to declare whether its end field is inclusive/exclusive and whether it bounds starts or full occupancy.
- Validate `last_seating_at + duration <= hard_close_at` only when the operator selects a hard-clear policy; some venues intentionally seat before close and serve afterward.
- Display explicit operator wording: “last bookable arrival,” “expected table release,” and “venue closes,” avoiding bare “end time.”
- Where vendor semantics remain unverified, fail configuration import closed or request operator confirmation; do not infer from labels.

## CLAIMS

- CLAIM: Tablein opening-hours end denotes actual closing, and last booking is derived from duration. — RISK: normal — PRIMARY: Tablein help and onboarding — STATUS: supported
- CLAIM: “Last seating” can be earlier than venue close and denotes a booking/arrival start. — RISK: normal — PRIMARY: Resy/Semma first-party interview — STATUS: supported for the example, not universal
- CLAIM: Major reservation platforms do not share one documented meaning for a bare `end time`. — RISK: high — PRIMARY: Tablein, Hostme, Tock, Resy official domains — STATUS: partial; terminology differs, but some vendor configuration docs remain unavailable
- CLAIM: Operator systems should model last seating, expected departure, and hard close separately. — RISK: normal — PRIMARY: derived policy from documented semantic differences — STATUS: supported recommendation, not a vendor rule

## EXPAND

- OPEN: Obtain authenticated/public operator configuration documentation for Tock, OpenTable, Resy, SevenRooms, and Toast defining service/shift end and duration interaction.
- OPEN: Test each platform’s final offered slot against configured duration and end time in a sandbox account.
- OPEN: Resolve whether Hostme online-reservation-hours end is inclusive and whether a booking may extend beyond it.
