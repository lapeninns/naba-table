# Cross-Flow Notes

Source: worker analysis `cross-flow assertions`

Key takeaways:

- Redirected seating entrypoints must land on the same canonical `/floor-plan` experience.
- Selection and filters must remain stable across route entrypoints.
- Selection should survive date/time changes when the table remains visible.
- Selection should disappear only for valid reasons: explicit close, second click, or the selected table becoming hidden by active filters.
- Desktop and mobile detail surfaces must remain content-equivalent.
- No mutation/navigation controls may remain in the header, desktop inspector, or mobile sheet.
