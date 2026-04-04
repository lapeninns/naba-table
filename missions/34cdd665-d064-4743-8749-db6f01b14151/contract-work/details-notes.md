# Details and Selection Notes

Source: worker analysis `inspector selection assertions`

Key takeaways:

- Selecting a table must open a read-only details surface.
- Desktop uses a persistent side panel; mobile uses a bottom sheet.
- Both responsive variants must show the same core facts: table number, status, capacity, zone, seating type, current party, and timing.
- All detail states must be passive and informational only.
- Explicit close and mobile sheet dismissal must clear selection.
- Selection should persist through non-hiding state changes and clear when the selected table is no longer visible.
