---
name: Ops Dashboard
description: Guidelines for working with the restaurant operations dashboard, including booking management, table assignments, and realtime updates.
triggers:
  - ops
  - dashboard
  - restaurant management
  - table management
---

# Ops Dashboard Skill

This skill provides guidance for working with the restaurant operations dashboard.

## Overview

The ops dashboard allows restaurant staff to:

- View and manage bookings
- Assign tables manually
- Mark guests as seated/no-show
- View capacity and availability
- Manage walk-ins

## Key Files

| Component        | Location                                   |
| ---------------- | ------------------------------------------ |
| Dashboard Layout | `src/app/app/(app)/layout.tsx`             |
| Booking List     | `src/components/features/dashboard/`       |
| Table Timeline   | `src/components/features/tables/timeline/` |
| Realtime Hooks   | `src/hooks/ops/`                           |
| Ops API Routes   | `src/app/api/ops/`                         |

## Architecture

### Realtime Updates

- Uses Supabase Realtime for live booking updates
- Connection status shown via beacon component
- Automatic reconnection on disconnect

### State Management

- React Query for server state
- Zustand for UI state
- URL state for filters and pagination

## Common Tasks

### Adding a New Booking Action

1. Add API route in `src/app/api/ops/bookings/[id]/`
2. Create mutation hook in `src/hooks/ops/`
3. Add UI trigger in booking card/dialog
4. Handle optimistic updates

### Modifying Table Timeline

1. Review `src/components/features/tables/timeline/`
2. Update time slot rendering
3. Handle drag-and-drop for reassignment
4. Test with various booking densities

### Adding Dashboard Filters

1. Add filter state to URL params
2. Update query hook to include filter
3. Add filter UI component
4. Persist filter preferences

## Permissions

- `ops:read` - View bookings and tables
- `ops:write` - Modify bookings, assign tables
- `ops:admin` - Restaurant settings, user management

## Testing Checklist

- [ ] Booking list loads correctly
- [ ] Realtime updates work
- [ ] Table assignment saves
- [ ] Status transitions work
- [ ] Filters persist on refresh
- [ ] Mobile responsive layout
