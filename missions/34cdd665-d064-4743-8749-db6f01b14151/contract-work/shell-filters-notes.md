# Shell and Filters Notes

Source: worker analysis `viewer shell assertions`

Key takeaways:

- Keep `/floor-plan` as the canonical authenticated route and preserve redirects from `/app/seating` and `/app/seating/floor-plan`.
- Preserve the current data sources and make the redesign presentation-only from a data-contract perspective.
- The header must become informational only, with no booking-launch or booking-browse CTAs.
- Zone, date, search, and time controls must remain available and update the visible canvas state without navigation side effects.
- Search-empty behavior must remain explicit and non-destructive.
- Table selection must only update local UI state and open passive details.
- No mutation or booking-navigation controls may remain anywhere on the surface.
