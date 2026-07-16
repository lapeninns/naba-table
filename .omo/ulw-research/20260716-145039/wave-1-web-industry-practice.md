# Wave 1: external industry practice

## Key findings

- Tock and Tablein define hard-finish models where duration determines the last available start.
- Yelp, Libro, and TableGo model last seating and party-size duration as separate dimensions.
- “Close” is not universally defined, so internal product semantics must choose the arithmetic.
- When both a hard finish and last seating apply, the compositional formula is `min(lastSeating, hardEnd-duration)`, or `hardEnd-max(buffer,duration)`.

## Primary sources

- https://tock.zendesk.com/hc/en-us/articles/360031223931-Setting-Reservation-Hours-and-Turn-Times-for-Blueprints
- https://help.tablein.com/et-up-opening-hours
- https://biz.yelp.com/support-center/article/Understanding-Yelp-Reservations-Sheets
- https://business.tablego.uk/help-center/configure-business-hours

## EXPAND

- DEAD END: SevenRooms and Resy public documentation — exhaustive English searches returned no indexable authoritative rule pages.
- DEAD END: exact GitHub `last_seating` implementations — results were sparse or unrelated; vendor documentation provided the real implementation semantics.
- DEAD END: universal meaning of restaurant “closing time” — disproved by conflicting primary sources.
- DEAD END: additive duration plus last-seating-buffer rule — no authoritative support found; only separately named cleanup/reset buffers justify additive time.
- LEAD: Repository owners should map the current Nabatable `close` field to either hard-finish or latest-arrival semantics before selecting the compatibility default. — WHY: external practice cannot resolve an ambiguous internal contract — ANGLE: tests/history/settings agents’ evidence.
