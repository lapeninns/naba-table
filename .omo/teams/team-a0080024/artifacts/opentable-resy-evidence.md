# OpenTable and Resy: reservation end semantics

Accessed: 2026-07-16  
Scope: official operator documentation only; English searches.

## Executive verdict

- **Resy — supported:** the shift's last/end boundary is a **last seating / reservation-start boundary**, not the expected guest-departure time. Guest occupancy is modeled separately by a party-size **Turn Time**. Evidence: Resy describes pacing across the shift's “first to last seating time,” while Turn Time is the allotted dining duration and is measured from `Seated` to `Finished`.
- **OpenTable — unresolved from accessible primary evidence:** the official support hub exposes “schedule,” “availability,” “shift settings,” and a “Turn Times Analysis” article, but the material articles returned Salesforce/JavaScript errors. It would be unsafe to state whether OpenTable's shift end means last booking or departure from the pages successfully fetched.

## Resy primary evidence

| Official page | Page date | Quote (<20 words) | What it establishes | Reliability |
|---|---:|---|---|---|
| [Turn Times](https://helpdesk.resy.com/en_us/how-to-setup-flexible-seating-to-maximize-covers-BkL3bvQLO) | 2025-10-09 | “Turn times are based off the average time a party size is expected to dine” | Duration varies by party size and represents expected dining occupancy. | High: first-party operator help |
| [Turn Times](https://helpdesk.resy.com/en_us/how-to-setup-flexible-seating-to-maximize-covers-BkL3bvQLO) | 2025-10-09 | “time from when guest status is changed to ‘Seated’ to when guest status is changed to ‘Finished’” | Analytics definition is seated-to-finished, i.e. occupancy/departure semantics. | High |
| [Turn Times](https://helpdesk.resy.com/en_us/how-to-setup-flexible-seating-to-maximize-covers-BkL3bvQLO) | 2025-10-09 | “the next available booking will be at 6:30pm” | A reservation start plus turn time controls the next bookable start. | High |
| [Customize Turn Times](https://helpdesk.resy.com/turn-times-B1K2bIGXc) | 2025-10-08 | “maximum amount of time that is allotted for each party size in your shift to dine” | Configured duration is party-size-specific and separate from shift hours. | High |
| [Availability and Pacing Updates](https://helpdesk.resy.com/en_us/availability-and-pacing-updates-S1T3bPXLd) | 2025-10-08 | “from the first to last seating time for this shift” | Shift pacing interval terminates at a last **seating**, not a departure. | High |
| [Availability and Pacing Updates](https://helpdesk.resy.com/en_us/availability-and-pacing-updates-S1T3bPXLd) | 2025-10-08 | “maximum amount of covers bookable online every 15 minutes throughout your shift” | Pacing governs bookable arrivals in 15-minute increments. | High |
| [Fixed Seating Times](https://helpdesk.resy.com/how-to-setup-fixed-seating-times-for-your-shifts-H1v2ZPm8O) | 2025-10-08 | “dinner seatings at 5pm, 7pm, and 9pm” | Resy calls the bookable times within a shift “seatings.” | High |
| [Shift Editor](https://helpdesk.resy.com/en_us/how-to-create-and-edit-a-shift-in-dashboard-service-settings-ByNaZwmIu) | 2025-10-09 | “Change hours, reservation availability, table access and pacing” | A shift bundles hours with separate availability, table, pacing, and reservation settings. | High |
| [Setting up Slots](https://helpdesk.resy.com/how-to-setup-slots-in-the-resy-dashboard-H1c3bvQ8d) | 2026-04-29 | “Adjusting the turn time specific to the selected slots” | Duration can be overridden for individual reservation slots. | High |
| [Advanced Analytics: Spend & Turn Times](https://helpdesk.resy.com/pos-spend-turn-times-SJF3X8e3T) | 2026-03-26 | “Turn Times by Party Size shows your average turn time for each party size.” | Operational analytics preserve the party-size dimension. | High |
| [Single Day Shift Updates](https://helpdesk.resy.com/how-to-make-a-single-day-edit-in-the-dashboard-service-settings-rJf6bD7IO) | 2025-10-09 | “live as soon as you hit ‘Save’ if the shift is within your online booking window” | “Online booking window” is a separate publication horizon, not the shift's end. | High |

### Resy terminology

- **Shift / shift hours:** recurring or single-day service configuration.
- **Seating time:** a bookable guest-arrival/reservation-start time within the shift.
- **First/last seating time:** bounds of paced reservation starts.
- **Turn Time:** expected/allotted dining duration, configurable by party size, table policy, or slot.
- **Pacing:** maximum covers bookable per 15-minute seating interval.
- **Availability / table access:** whether inventory is online, in-house, or walk-in.
- **Online booking window:** how far out a saved shift is currently live; distinct from intraday seating hours.

### Resy operator implications

1. Persist service/shift bounds as allowed **reservation start times**.
2. Calculate expected end as `reservation_start + applicable_turn_time`.
3. Resolve turn time by party size, then apply table/slot/custom-policy overrides.
4. Do not reject a valid final seating merely because its expected end exceeds the shift's last seating time.
5. Capacity must consider overlapping occupancy beyond the last seating boundary.
6. Model booking horizon (“online booking window”) separately from daily service hours.

## OpenTable primary evidence and gap

| Official page | Date | Quote (<20 words) | What it establishes | Reliability |
|---|---:|---|---|---|
| [OpenTable Restaurant Support](https://support.opentable.com/s/?language=en_US) | Not shown | “Customize your schedule and availability” | OpenTable separates scheduling/availability as operator controls. | Medium-high: first-party index, not detailed article |
| [OpenTable Restaurant Support](https://support.opentable.com/s/?language=en_US) | Not shown | “Customize your availability, schedule, and shift settings” | Confirms official “shift settings” terminology. | Medium-high |
| [Turn Times Analysis for GuestCenter](https://support.opentable.com/s/article/Turn-Times-Analysis-for-GuestCenter?language=en_US) | Not retrievable | No safe content quote: article rendered a Salesforce error. | Confirms an official turn-time topic exists, but not its semantics. | Low for semantics because body was inaccessible |

### OpenTable contradictions/dead ends

- Exact official support searches surfaced the relevant schedule/shift and Turn Times Analysis titles, but opening the pages produced “Sorry to interrupt,” CSS, communication, or Salesforce callback errors.
- Search results also returned unrelated support pages because the Salesforce support index injects “trending articles.”
- No successfully fetched first-party OpenTable page defined shift-end, last-seating, or party-size duration semantics. Therefore no positive OpenTable end-time verdict is supportable from this pass.

### OpenTable operator implication

Treat OpenTable compatibility as **unverified**. Do not cite OpenTable as evidence that a service end is either last seating or departure until the detailed first-party article can be retrieved through an authenticated/rendered support session or supplied directly by OpenTable.

## Counter-search findings

- Resy counter-searches for “last reservation,” “event end,” and “booking cutoff” returned no stronger official definition contradicting the first/last-seating language.
- No Resy page found described shift end as the time every seated guest must be finished.
- Resy's “event end time” wording in the Turn Times page coexists with explicit “first to last seating time” wording elsewhere. Read together, the stronger operational definition is a seating-time range; turn time separately extends occupancy.
- OpenTable cannot be treated as contradictory evidence either way because the relevant bodies were inaccessible.

## English query log (20 distinct searches)

1. `site:support.opentable.com shifts booking window last seating turn time party size duration restaurant`
2. `site:restaurant.opentable.com "turn time" reservations party size`
3. `site:support.opentable.com "shift" "end time" reservations`
4. `site:help.resy.com OR site:helpdesk.resy.com "turn time" "party size"`
5. `site:support.opentable.com/s/article "Customize your availability, schedule, and shift settings"`
6. `site:support.opentable.com/s/article "turn times" "party size" OpenTable`
7. `site:support.opentable.com/s/article OpenTable "end time" "shift" availability`
8. `site:support.opentable.com/s/article OpenTable "last reservation" schedule`
9. `site:helpdesk.resy.com "Shift Editor" "event end time"`
10. `site:helpdesk.resy.com "shift start time" "event end time"`
11. `site:helpdesk.resy.com "booking window" reservations shift`
12. `site:helpdesk.resy.com "last seating" OR "last reservation"`
13. `Resy help shift settings service settings start time end time reservations`
14. `Resy help booking window days in advance online booking cutoff`
15. `Resy help customize policies booking window shift settings`
16. `Resy help turn times table availability shift end`
17. `site:helpdesk.resy.com Resy "Service Settings"`
18. `site:helpdesk.resy.com Resy "Shift Settings"`
19. `site:helpdesk.resy.com Resy "Online booking" "days"`
20. `site:helpdesk.resy.com Resy "booking cutoff"`

## CLAIMS

- CLAIM: Resy shift pacing runs through the last seating time, not the final guest departure — RISK: normal — SOURCES: helpdesk.resy.com/availability-and-pacing-updates, helpdesk.resy.com/turn-times — COUNTER: no official departure-bound shift definition found — PRIMARY: Resy operator help.
- CLAIM: Resy Turn Time is party-size dining duration and separates reservation start from expected finish — RISK: normal — SOURCES: helpdesk.resy.com/how-to-setup-flexible-seating-to-maximize-covers, helpdesk.resy.com/turn-times, helpdesk.resy.com/pos-spend-turn-times — COUNTER: no contradictory official definition found — PRIMARY: Resy operator help.
- CLAIM: OpenTable end-time semantics remain unresolved in this pass — RISK: normal — SOURCES: support.opentable.com support index and inaccessible Turn Times Analysis article — COUNTER: no accessible official definition found — PRIMARY: OpenTable support.

## EXPAND

- OPEN: Retrieve OpenTable's detailed “Customize your availability, schedule, and shift settings” and “Turn Times Analysis for GuestCenter” bodies through a rendered/authenticated support session.
- OPEN: Locate a Resy page that labels the shift-hours input fields directly, to remove the residual ambiguity around the phrase “event end time.”
