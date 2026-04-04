## Area: Read-Only Shell & Filters

### VAL-FLOOR-SHELL-001: Read-only header and shell

The authenticated `/floor-plan` page presents an informational header and map-first shell with no booking creation, assignment, or booking-navigation controls. Buttons or links labeled `New booking`, `Browse bookings`, `Assign booking`, or equivalent mutation-era controls are absent from the header and shell, and nearby header/shell copy does not describe booking actions or workflows.
Tool: agent-browser
Evidence: screenshot(header + hero canvas), console-errors, interaction log confirming absence of legacy CTA labels, URL(`/floor-plan`)

### VAL-FLOOR-SHELL-002: Header context summary stays in sync

The page header context summary reflects the active zone, date, and time that the viewer is using. Changing zone, date, or time updates that summary in place without exposing action-oriented copy.
Tool: agent-browser
Evidence: screenshot(before/after context change), console-errors, interaction log describing changed context labels

### VAL-FLOOR-SHELL-003: Zone, date, search, and time controls remain in-place filters

The page continues to expose zone, date, search, and time controls, and using them updates the visible floor-plan state in place without leaving the canonical `/floor-plan` route. Search continues to match visible tables by table number, current party name, and zone name.
Tool: agent-browser
Evidence: screenshot(before/after each control), console-errors, interaction log covering zone change, date change, search match, and time change, URL(`/floor-plan`)

### VAL-FLOOR-SHELL-004: Empty-search state stays informational and recoverable

When the user enters a search term that matches no visible tables, the page keeps the floor-plan shell visible and shows the empty-search message on the canvas. Clearing the search restores the visible tables without showing action prompts or stale empty-state content.
Tool: agent-browser
Evidence: screenshot(empty-search state), console-errors

## Area: Occupancy Canvas

### VAL-FLOOR-CANVAS-001: Legend and summary reflect visible occupancy state

The hero floor canvas displays a status legend and occupancy summary counts that match the visible tables currently shown on the map. The legend and summary use the same visible-status buckets as the floor-plan status model: available, reserved, seated, loading, and out of service. Counts update after zone, date, search, or time changes and do not include tables that are currently hidden from the canvas.
Tool: agent-browser
Evidence: screenshot(canvas + legend + summary before/after filter), console-errors, interaction log describing count changes

### VAL-FLOOR-CANVAS-002: Keyboard pan, zoom, and reset remain available

When the floor canvas has focus, arrow keys pan the map, `+`/`-` change zoom, and `0` or `Home` restores the initial overview without breaking the page.
Tool: agent-browser
Evidence: screenshot(focused canvas), console-errors, interaction log describing pan/zoom/reset result

### VAL-FLOOR-CANVAS-003: Pointer drag pans without accidental selection

Dragging valid canvas space pans the map. The drag interaction does not accidentally select a table, and interactions that start on table buttons, zoom buttons, scrubber step buttons, or the scrubber slider do not trigger unintended canvas panning.
Tool: agent-browser
Evidence: screenshot(after drag), console-errors, interaction log describing drag result

### VAL-FLOOR-CANVAS-004: Table activation only changes selection state

Clicking or keyboard-activating a visible table toggles its selected state and opens read-only details for that table only. The interaction does not navigate to bookings, launch a mutation flow, or expose mutation controls.
Tool: agent-browser
Evidence: screenshot(selected table), console-errors, URL(unchanged `/floor-plan`)

### VAL-FLOOR-CANVAS-005: Time scrubbing updates occupancy in place

Using the floor-plan time scrubber slider or its step controls changes the visible occupancy state on the map while keeping the user on the same page, without starting a canvas pan or leaving stale legend/count data behind.
Tool: agent-browser
Evidence: screenshot(before/after time change), console-errors, interaction log describing slider + step-control result

## Area: Selected Table Details

### VAL-FLOOR-DETAIL-001: Desktop details panel is read-only and complete

On a desktop viewport, selecting a table opens a details panel that shows the table number, status, capacity, zone, seating type, current party when present, and timing when present. The panel contains no booking, assignment, or navigation buttons or links, and the page URL stays on `/floor-plan`.
Tool: agent-browser
Evidence: screenshot(desktop details panel), console-errors, interaction log listing rendered fields and action absence

### VAL-FLOOR-DETAIL-002: Mobile details sheet mirrors the read-only details

On a mobile viewport, selecting a table opens a bottom sheet that presents the same read-only table facts as the desktop panel for the same selected table. The sheet title/description announce a read-only details surface and do not reference bookings, assignments, or actions. Dismissing the sheet clears the active selection.
Tool: agent-browser
Evidence: screenshot(mobile sheet), console-errors, interaction log comparing mobile fields to desktop fields

### VAL-FLOOR-DETAIL-003: All detail states remain informational only

For available, loading, or out-of-service tables, the details surface uses passive explanatory copy. For reserved or seated tables, the details surface shows occupancy facts only. No table state implies that the user should create, assign, or browse bookings from this screen.
Tool: agent-browser
Evidence: screenshot(state copy), console-errors, interaction log describing rendered copy for at least one passive state

### VAL-FLOOR-DETAIL-004: Idle desktop panel is passive before selection

On a desktop viewport before any table is selected, the details panel area shows passive read-only guidance and does not mention bookings, assignments, or action prompts.
Tool: agent-browser
Evidence: screenshot(idle desktop panel), console-errors

## Cross-Area Flows

### VAL-FLOOR-CROSS-001: Seating entrypoints still redirect to the canonical viewer

Visiting `/app/seating` or `/app/seating/floor-plan` redirects the user to `/floor-plan`, and the user lands on the read-only occupancy viewer.
Tool: agent-browser
Evidence: screenshot(redirect destination), console-errors, URL transition record

### VAL-FLOOR-CROSS-002: Selection persists and refreshes through non-hiding state changes

After selecting a visible table, changing the current date, time, zone, or search term keeps that table selected as long as it remains visible. The details surface refreshes in place to reflect the current visible occupancy state.
Tool: agent-browser
Evidence: screenshot(before/after visible-state change), console-errors, interaction log covering date/time and a filter change that still keeps the table visible

### VAL-FLOOR-CROSS-003: Explicit close and canvas pan clear selection

Explicitly closing the details surface, dismissing the mobile sheet, clicking the same table again, or beginning a valid pointer-initiated canvas pan clears the active selection and removes the details UI.
Tool: agent-browser
Evidence: screenshot(before/after clear action), console-errors, interaction log covering close, same-table toggle, or pan-clear behavior

### VAL-FLOOR-CROSS-004: Hidden selections do not show stale details

If zone or search filters make the selected table no longer visible, the details surface closes instead of showing stale information or mutation-era actions while that table is hidden.
Tool: agent-browser
Evidence: screenshot(filtered-hidden state), console-errors

### VAL-FLOOR-CROSS-005: Responsive container swap preserves the same selection

If the viewport changes between desktop and mobile while a table is selected, only one details container is visible at a time, and it continues showing the same selected table in read-only form.
Tool: agent-browser
Evidence: screenshot(desktop selected state), screenshot(mobile selected state), console-errors
