# Wave 1 — Official TheFork Product Pages

Observed at: 2026-07-16.

## Query log

The following distinct official-domain searches were submitted or queued as the exhaustive query matrix:

1. `site:theforkmanager.com "opening hours" reservations availability`
2. `site:theforkmanager.com "last booking" OR "last reservation"`
3. `site:theforkmanager.com "reservation duration" OR "booking duration"`
4. `site:theforkmanager.com "closing time" reservations`
5. `site:theforkmanager.com "service end" reservations`
6. `site:theforkmanager.com "after closing" booking`
7. `site:theforkmanager.com "availability rules" booking`
8. `site:theforkmanager.com "booking slots" duration`
9. `site:theforkmanager.com/en/blog opening hours reservation`
10. `site:theforkmanager.com/en/academy booking slots duration`
11. `site:theforkmanager.com/en/product availability reservations`
12. `site:thefork.com/help restaurant opening hours reservation time`
13. `site:thefork.com "last seating" reservation`
14. `site:thefork.com "booking duration" restaurant`
15. `site:theforkmanager.com horaires fermeture réservation durée`
16. `site:theforkmanager.com horario cierre reserva duración`
17. `site:theforkmanager.com orario chiusura prenotazione durata`

Search execution result: the search endpoint aborted without returning results on every attempted batch, including a single-query retry. No snippets were accepted as evidence.

## Direct official URLs attempted

- `https://www.theforkmanager.com/`
- `https://www.theforkmanager.com/robots.txt`
- `https://www.theforkmanager.com/sitemap.xml`

Direct-page opening through the web endpoint aborted. A sandboxed `curl` request to `robots.txt` failed DNS resolution. Two required network-escalation retries timed out during approval review.

## Opened pages

None. No official page body was successfully retrieved in this lane.

## Findings

- No public official-page claim can be supported from this lane because no source body was retrieved.
- No statement about reservations finishing after close can be inferred from this access failure.
- This is an access dead end, not evidence of absence and not evidence of product behavior.

## Dead ends

- Additional agent fan-out: all six spawn attempts failed because the shared agent thread limit was reached.
- General web search: aborted on every attempt.
- Direct web open: aborted on every attempt.
- Direct `curl`: DNS unavailable inside the sandbox; escalation did not complete.

## EXPAND

- LEAD: Retry the same query matrix in a parent or sibling with functioning web access — WHY: all substantive evidence still depends on primary-page retrieval — ANGLE: official TheFork domains only, sitemaps first.
- LEAD: Inspect authenticated TheFork Manager settings/help if public pages remain silent — WHY: service-end semantics may exist only inside the product — ANGLE: opening hours, reservation duration, last booking, availability-rule labels.
