# Research: Enhanced Booking Search and Filtering System

---

task: enhanced-booking-search-filters
timestamp_utc: 2026-01-19T09:37:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: [feat.booking.search.enhancement]
related_tickets: []

---

## Requirements

### Functional Requirements

- **Party Size Filtering**: Enable filtering bookings by party size (e.g., 1-2, 3-4, 5+ guests)
- **Time Slot Filtering**: Add filtering by specific time slots (e.g., breakfast 6-10am, lunch 11am-3pm, dinner 5-10pm)
- **Enhanced Search**: Improve search functionality to include booking reference numbers and phone numbers
- **Combined Filters**: Allow multiple filters to work together seamlessly (party size + time slot + status + search)
- **Filter Persistence**: Maintain filter state in URL for bookmarkability and back button support
- **Clear Filters**: Provide easy way to clear all active filters

### Non-Functional Requirements

- **Accessibility**: Full WCAG/WAI-ARIA compliance for all filter controls
- **Performance**: Filter application should not exceed 500ms response time (P95)
- **Mobile-First**: Responsive design optimized for mobile devices
- **Progressive Enhancement**: Core functionality works without JavaScript
- **Internationalization**: Support for different time zones and date formats

## Existing Patterns & Reuse

### Current System Analysis

Based on the codemap analysis, the current system provides:

**Strengths to Reuse:**

- **URL State Management**: Existing pattern for persisting filters in URL parameters
- **Debounced Search**: 500ms debounce implementation for search input
- **Multi-Select Status Filter**: Proven pattern for checkbox-based filtering
- **Zustand State Management**: Established state management pattern
- **API Query Builder**: Extensible query building in `buildSearch()` function
- **Supabase Query Pattern**: Existing database query structure with conditional filtering

**Available Database Fields Not Exposed:**

- `party_size` (integer) - ready for filtering implementation
- `start_time` (time) - available for time slot filtering
- `customer_phone` (text) - can be added to search functionality

**Reusable Components:**

- `OpsStatusFilter.tsx` - Pattern for multi-select filters
- `Input` component from Shadcn - For search and filter inputs
- `Badge` component - For displaying active filters
- URL parameter extraction and synchronization logic

### Architectural Patterns to Follow

1. **Filter State Management**: Extend existing `useOpsBookingsTableState` hook
2. **API Parameter Building**: Add new parameters to `buildSearch()` function
3. **Database Query Extension**: Add conditional clauses to existing query builder
4. **UI Component Structure**: Follow existing filter component patterns

## External Resources

- **Shadcn UI Documentation**: Component patterns for filters and inputs
- **PostgreSQL Date/Time Functions**: For time slot filtering logic
- **Web Accessibility Guidelines**: WCAG 2.1 AA compliance for filter controls
- **Progressive Enhancement Best Practices**: Ensuring functionality without JavaScript

## Constraints & Risks

### Technical Constraints

- **Supabase Remote Only**: All database changes must be applied to remote environments
- **Existing API Contract**: Must maintain backward compatibility with current API
- **Database Performance**: New filters should not significantly impact query performance
- **Mobile UI Space**: Limited screen real estate on mobile devices

### Risks

- **Query Performance**: Adding multiple new filters could slow down database queries
- **UI Complexity**: Too many filter options might overwhelm users
- **URL Length**: Multiple filter parameters could create long URLs
- **Time Zone Handling**: Time slot filtering needs proper restaurant timezone consideration

### Mitigation Strategies

- **Database Indexing**: Ensure proper indexes on new filter columns
- **Progressive Disclosure**: Hide advanced filters behind expandable sections
- **Query Optimization**: Use efficient database queries and consider pagination
- **Time Zone Awareness**: Leverage existing restaurant timezone handling

## Open Questions (owner, due)

1. **Time Slot Definitions**: Should time slots be configurable per restaurant or use standard definitions? (Product, 2026-01-20)
2. **Party Size Buckets**: What party size ranges should be available as filter options? (Product, 2026-01-20)
3. **Search Scope**: Should phone number search be exact match or partial match? (Engineering, 2026-01-20)
4. **Filter Priority**: What should be the default order of filter display? (Design, 2026-01-21)

## Recommended Direction (with rationale)

### Phase 1: Core Filter Enhancement

**Implement party size and time slot filtering** using existing patterns:

- Extend `useOpsBookingsTableState` with new filter states
- Add parameters to `buildSearch()` function
- Enhance API route with new query conditions
- Create reusable filter components following `OpsStatusFilter` pattern

**Rationale**: Leverages existing proven patterns, minimal architectural changes, provides immediate value to restaurant staff.

### Phase 2: Search Enhancement

**Expand search to include booking references and phone numbers**:

- Extend search sanitization to handle phone number patterns
- Add booking reference field to search query
- Maintain existing debounced search behavior

**Rationale**: Builds on existing search infrastructure, addresses common staff workflows.

### Phase 3: UX Polish

**Improve filter management and display**:

- Add active filter badges with clear functionality
- Implement filter persistence and restoration
- Add responsive design improvements for mobile

**Rationale**: Enhances user experience without changing core functionality.

This approach minimizes risk by reusing proven patterns while delivering significant functionality improvements for restaurant operations staff.
