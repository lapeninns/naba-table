# Implementation Plan: Enhanced Booking Search and Filtering System

---

task: enhanced-booking-search-filters
timestamp_utc: 2026-01-19T09:37:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: [feat.booking.search.enhancement]
related_tickets: []

---

## Objective

We will enable restaurant operations staff to efficiently find and manage bookings through enhanced search and filtering capabilities so that they can quickly locate specific reservations, optimize table management, and improve customer service response times.

## Success Criteria

- [ ] Staff can filter bookings by party size ranges (1-2, 3-4, 5+ guests)
- [ ] Staff can filter bookings by time slots (breakfast, lunch, dinner)
- [ ] Search functionality includes booking references and phone numbers
- [ ] Multiple filters work together seamlessly with <500ms response time
- [ ] Filter state persists in URL and survives page refreshes
- [ ] Interface is fully accessible (WCAG 2.1 AA compliant)
- [ ] Mobile experience is optimized with responsive design
- [ ] Zero regression in existing search and filter functionality

## Architecture & Components

### Frontend Components

**OpsPartySizeFilter.tsx** (New)

- Role: Multi-select filter for party size ranges
- State: Local component state synced to global store
- URL state: `partySizes=1-2,3-4,5+`

**OpsTimeSlotFilter.tsx** (New)

- Role: Single or multi-select filter for time-based filtering
- State: Local component state synced to global store
- URL state: `timeSlots=breakfast,lunch,dinner`

**Enhanced OpsBookingsClient.tsx** (Modified)

- Role: Main container integrating new filters
- State: Uses enhanced `useOpsBookingsTableState`
- URL state: Manages all filter parameters

**ActiveFiltersBar.tsx** (New)

- Role: Display active filters with clear functionality
- State: Derived from global filter state
- URL state: Updates URL when filters are cleared

### State Management

**Enhanced useOpsBookingsTableState.ts** (Modified)

- Add `partySizes: string[]` state
- Add `timeSlots: string[]` state
- Extend `queryFilters` computation to include new filters
- Update URL synchronization logic

### API Layer

**Enhanced bookings.ts service** (Modified)

- Extend `buildSearch()` to handle `partySizes` and `timeSlots` parameters
- Add parameter validation and sanitization

**Enhanced route.ts API handler** (Modified)

- Add Zod schema validation for new parameters
- Extend Supabase query builder with new conditional clauses
- Maintain existing error handling and response format

### Database Layer

**Query Extensions** (No schema changes required)

- Party size filtering: `query.gte('party_size', min) AND query.lte('party_size', max)`
- Time slot filtering: Extract hour from `start_time` and apply range conditions
- Enhanced search: Add `booking_reference` and `customer_phone` to ILIKE query

## Data Flow & API Contracts

### New API Parameters

```
GET /api/ops/bookings?partySizes=1-2,5+&timeSlots=lunch,dinner&query=REF123
```

### Request Schema Extensions

```typescript
{
  partySizes?: string[],      // ["1-2", "3-4", "5+"]
  timeSlots?: string[],       // ["breakfast", "lunch", "dinner"]
  query?: string,             // Enhanced to include refs and phones
  // ... existing parameters
}
```

### Response Format (Unchanged)

```typescript
{
  data: BookingDTO[],
  pageInfo: {
    page: number,
    pageSize: number,
    totalCount: number,
    hasNext: boolean,
    hasPrev: boolean
  }
}
```

### Error Handling

- Invalid party size ranges: 400 Bad Request
- Invalid time slot values: 400 Bad Request
- Malformed search queries: Existing error handling

## UI/UX States

### Filter States

- **Loading**: Skeleton filters while data loads
- **Empty**: No active filters, show default state
- **Active**: Filters applied, show clear options
- **Error**: Invalid filter values, show validation messages

### Interaction Patterns

- **Progressive Disclosure**: Advanced filters in collapsible section
- **Immediate Feedback**: Filter results update without page reload
- **Keyboard Navigation**: Full keyboard access to all filter controls
- **Mobile Optimization**: Bottom sheet for filters on mobile

## Edge Cases

### Filter Combinations

- Party size + time slot + status filters together
- Search query with active filters
- Invalid filter parameter combinations
- URL parameter overflow (too many filters)

### Data Edge Cases

- Bookings with missing party size data
- Bookings spanning multiple time slots
- Special characters in phone numbers
- Very long booking reference numbers

### Performance Edge Cases

- Large result sets with complex filters
- Rapid filter changes (debouncing)
- Network timeouts during filter application
- Browser back button with many filter states

## Testing Strategy

### Unit Tests

- Filter component logic and state management
- Parameter validation and sanitization
- URL parameter encoding/decoding
- Database query building logic

### Integration Tests

- API endpoint with new parameters
- State synchronization between components
- Filter persistence across page refreshes
- Error handling for invalid inputs

### E2E Tests

- Complete filter application flows
- Mobile responsive behavior
- Keyboard navigation scenarios
- Performance benchmarks for filter response times

### Accessibility Tests

- Screen reader compatibility
- Keyboard-only operation
- Color contrast and focus indicators
- ARIA attribute validation

## Rollout

### Feature Flag: `feat.booking.enhanced-filters`

- **Namespace**: `feat.booking.search.enhancement`
- **Exposure**: 10% → 50% → 100% over 2 weeks
- **Monitoring**: Filter usage metrics, response times, error rates

### Monitoring Dashboards

- **Filter Usage**: Track adoption of new filter options
- **Performance**: API response times with new filters
- **Errors**: Invalid parameter submissions
- **User Engagement**: Time to find bookings with/without filters

### Kill Switch

- Disable feature flag to revert to existing filters
- Database queries remain compatible with existing API
- No breaking changes to existing functionality

## DB Change Plan

### No Schema Changes Required

All enhancements use existing database fields:

- `party_size` (already indexed)
- `start_time` (already indexed)
- `customer_phone` (existing field)
- `booking_reference` (existing field)

### Query Optimization

- Analyze query performance with new filter combinations
- Add composite indexes if needed based on query patterns
- Monitor database load during rollout

### Backup Reference

- Current database backup: `backups/production_backup.sql`
- Point-in-time recovery available through Supabase

### Performance Monitoring

- Query execution times with new filters
- Database load during peak usage
- Index usage statistics for filter queries
