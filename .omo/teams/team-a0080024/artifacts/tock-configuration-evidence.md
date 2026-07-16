# Tock configuration evidence: service end, last seating, pacing, and duration

Accessed 2026-07-16. Scope stopped on team-lead instruction after the initial official-source sweep.

## Direct answer

Tock does **not** give “end time” one universal meaning across its two reservation-management modes:

- In **Availability Planning**, a Service’s `End time` is the **last reservation start / last seating**, not guest departure or service finish.
- In legacy **Blueprints**, `Reservation Hours` end is when the **last reservation should be finished**.

Consequently:

- Availability Planning can legitimately have reservations whose turn extends past the Service End time. Tock’s own FAQ says a 10:00–14:00 service with two-hour turns needs the next service to begin at 16:00, describing 14:00 as “the last reservation start time.”
- For Blueprints, the latest feasible start is implied by the applicable turn duration: `reservation-hours end − turn time`. Because turn times vary by party-size range and can vary by Experience, different party sizes/Experiences can have different latest starts.
- Pacing is start-based: Tock measures covers that “can start per 15 minutes.” It is not a guest-departure cutoff.

## Primary Tock sources

### 1. Availability Planning: adding Services

URL: https://tock.zendesk.com/hc/en-us/articles/360043418212-Adding-Services-to-Your-Schedule-for-Availability-Planning

Short quotes:

- “This will be the time you want the last reservation to start.”
- “Services allow you to define and customize the days, times, capacities, and Experiences”

Date shown: embedded dashboard image filename is dated `2023-05-02`; no article publication/update date appeared in retrieved text.

Reliability: first-party Tock Help Center, explicit definition, mode-qualified. Strongest evidence for Availability Planning end semantics.

### 2. Availability Planning: Special Days

URL: https://tock.zendesk.com/hc/en-us/articles/5065508093076-Creating-a-Special-day-for-Availability-Planning

Short quote:

- “End time is when the last reservation begins.”

Date shown: none in retrieved text.

Reliability: first-party Tock Help Center; independently repeats the Availability Planning definition for one-off schedules.

### 3. Availability Planning FAQ

URL: https://tock.zendesk.com/hc/en-us/articles/360044451111-Availability-Planning-FAQs

Short quotes:

- “the system allows for a full turn before the second service can begin.”
- “the last reservation start time a full turn.”

Material example: a Brunch service ending at 14:00 with two-hour turn times permits Dinner to begin at 16:00.

Date shown: none in retrieved text.

Reliability: first-party FAQ with a concrete example. Strong evidence that a Service End is not the last guest departure.

### 4. Availability Planning: pacing and turn times

URL: https://tock.zendesk.com/hc/en-us/articles/360051296972-Configuring-Pacing-Turn-Times-for-Availability-Planning

Short quotes:

- “covers that can start per 15 minutes.”
- “Turn times control how long a reservation is booked for”
- “configured per party size for a specific time range”

Other material details: turn times are configurable in 15-minute increments for party sizes from one through twelve-or-more, and can vary by Experience and time range.

Date shown: embedded dashboard image filename is dated `2023-05-11`; no article publication/update date appeared in retrieved text.

Reliability: first-party configuration instructions. Strong for start-based pacing and party-size-specific duration.

### 5. Blueprints: Reservation Hours and Turn Times

URL: https://tock.zendesk.com/hc/en-us/articles/360031223931-Setting-Reservation-Hours-and-Turn-Times-for-Blueprints

Short quotes:

- “the end time reflects when the last reservation should be finished.”
- “Turn times represent how long a reservation will be seated.”
- “configured per party size range”

Date shown: none in retrieved text.

Reliability: first-party Tock Help Center, explicit and explicitly limited to Blueprints. Strongest evidence for finish-time semantics in that mode.

### 6. Blueprints: configuring reservation slots

URL: https://tock.zendesk.com/hc/en-us/articles/360031223871-Configuring-Blueprints

Short quotes:

- “Reservation slots use turn times and expand horizontally to fill that turn.”
- “The turn times appear as a visual aid”

Date shown: none in retrieved text.

Reliability: first-party operational instructions. Supports subtracting the applicable turn from a finish-defined Reservation Hours end when laying out table slots, while warning that Blueprint turn graphics are planning aids rather than automatic table pre-assignment.

### 7. Advanced Grid block semantics

URL: https://tock.zendesk.com/hc/en-us/articles/360043860371-Editing-the-advanced-grid-for-Availability-Planning

Short quote:

- “reservations [cannot] start within the blocked time, but they can still fall within”

Date shown: none in retrieved text.

Reliability: first-party instructions. Corroborates Tock’s distinction between preventing a start and allowing an existing reservation’s duration to overlap a time range.

### 8. Availability Planning overview

URL: https://tock.zendesk.com/hc/en-us/articles/360043851691-Availability-Planning-Overview

Short quotes:

- “Define the days of the week and times you’ll be offering reservations”
- “Modify your Pacing and Turn Times”

Date shown: none in retrieved text.

Reliability: first-party overview; useful for terminology and feature relationships, less precise than the configuration pages.

## Terminology mapping

| Tock term | Meaning |
|---|---|
| Availability Planning `Service Start time` | First reservation start offered |
| Availability Planning `Service End time` | Last reservation start / last seating |
| Blueprints `Reservation Hours end` | Target finish of the last reservation |
| `Turn time` | Duration for which a reservation is booked/seated and the table is blocked |
| `Pacing` | Cover-start limits per 15-minute interval; maximum covers includes in-house plus online starts |
| `Maximum capacity` | Guests seated at any given time; distinct from start-based pacing |
| `Business Page Hours` | Public-facing hours; explicitly separate from Blueprints Reservation Hours |

## Contradictions and resolution

The two official definitions appear contradictory only if “end time” is treated as a platform-wide field. They belong to different reservation-management modes:

- Availability Planning Service End = last start.
- Blueprints Reservation Hours end = last finish.

Operator policy and UI copy must therefore be mode-specific. A generic label such as “reservation end” is unsafe without identifying the Tock mode and field.

## Operator-policy implications

1. For an Availability Planning integration, interpret imported service end as an inclusive last-start cutoff. Do not subtract the guest duration from it.
2. Allow occupancy to extend after that cutoff. If a clean handoff to another service is required, schedule the later service after the longest applicable full turn; Tock’s FAQ models exactly this.
3. For a Blueprints-style finish cutoff, calculate the latest start from the party/Experience-specific turn: `latest_start = finish_end − applicable_turn`.
4. Do not assume one duration for all parties. Tock supports party-size-specific turn times, plus Experience- and time-range-specific overrides.
5. Model pacing separately from capacity and duration: pacing limits starts per 15 minutes; maximum capacity limits concurrent seated guests; turns occupy tables over time.
6. Keep operating/public hours separate from reservable inventory. Tock explicitly separates Business Page Hours from Blueprints Reservation Hours.
7. If the local platform exposes one neutral `service_end` field, require an explicit semantic enum such as `LAST_START` versus `LAST_FINISH`, or normalize to both `last_start_at` and `occupancy_end_at`.

## Search queries completed before stop

1. `site:exploretock.com/join/resources "service hours" reservations`
2. `site:get.tock.help "service hours" Tock reservations`
3. `site:help.tock.com "service hours" reservation`
4. `site:exploretock.com "last seating" Tock`
5. `Tock reservation management service hours duration pacing official`
6. `Tock help center create service hours reservation duration`
7. `site:tockhq.com "reservation duration"`
8. `site:exploretock.com/join/resources intitle:reservation pacing`
9. `site:tock.zendesk.com/hc/en-us/articles "End time" "last reservation"`
10. `site:tock.zendesk.com/hc/en-us/articles "Turn times" "party size" Tock`
11. `site:tock.zendesk.com/hc/en-us/articles inurl:360 "pacing" "service"`
12. `site:tock.zendesk.com/hc/en-us/articles after:2024-01-01 "Availability Planning" "End time"`

## Counterevidence and dead ends

- Searches against `get.tock.help` and `help.tock.com` did not surface operator documentation; the live indexed operator corpus is `tock.zendesk.com`.
- ExploreTock venue FAQs use business-authored phrases such as “last seating,” but they do not define Tock dashboard field semantics and were excluded from the core conclusion.
- Public Business Page hours cannot resolve reservation-end semantics because Tock says they are separate from Blueprints Reservation Hours.
- No material official PDF or changelog result concerning these exact field semantics surfaced before the team lead ordered retrieval stopped.
- No article publication/update timestamps were exposed in the retrieved Help Center text. Embedded image dates are reported only as dates shown, not treated as article dates.

## CLAIMS

- CLAIM: Availability Planning Service End is the last reservable start, not last guest departure. — RISK: high — PRIMARY: Tock Help Center articles 360043418212, 5065508093076, 360044451111 — COUNTER: Blueprints uses finish semantics, but it is a different mode.
- CLAIM: Blueprints Reservation Hours end is the intended finish of the last reservation. — RISK: high — PRIMARY: Tock Help Center article 360031223931 — COUNTER: Availability Planning uses last-start semantics, but it is a different mode.
- CLAIM: Party-size duration changes the latest start under a finish-defined cutoff. — RISK: normal — PRIMARY: articles 360031223931 and 360031223871 — COUNTER: no stronger mode-matched counterevidence found.
- CLAIM: Availability Planning pacing limits reservation starts per 15 minutes. — RISK: normal — PRIMARY: article 360051296972 — COUNTER: maximum capacity is concurrent occupancy, a separate control.

## EXPAND

none — team lead explicitly ordered all further search and expansion stopped; open source territories are recorded in dead ends.
