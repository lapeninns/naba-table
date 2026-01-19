# Enhanced Booking Search and Filtering System PRD

## Executive Summary

This PRD outlines the enhancement of the restaurant booking search and filtering system to improve operational efficiency for restaurant staff. The current system supports basic guest name/email search and status filtering, but lacks critical filtering capabilities for party size and time slots. This enhancement will enable staff to quickly locate specific reservations, optimize table management, and improve customer service response times.

## Current System Analysis

### Existing Capabilities

Based on the comprehensive codemap analysis, the current system provides:

**Search Functionality:**

- Guest name and email search with debounced input (500ms)
- SQL injection protection through input sanitization
- URL state persistence for search queries

**Filtering Capabilities:**

- Multi-select status filtering (confirmed, cancelled, etc.)
- Date range filtering with daily and time-window modes
- Table assignment filtering by table_id
- URL parameter synchronization for all filters

**Technical Foundation:**

- Zustand state management with URL synchronization
- Extensible API query builder pattern
- Supabase database with proper indexing
- Responsive UI with Shadcn components

### Identified Gaps

- **Party Size Filtering**: No ability to filter by number of guests
- **Time Slot Filtering**: No time-based filtering (breakfast/lunch/dinner)
- **Limited Search**: Only name/email, missing booking references and phone numbers
- **Filter Management**: No clear indication of active filters or bulk clear functionality

## Proposed Solution

### Phase 1: Core Filter Enhancement

#### Party Size Filtering

**Implementation:**

- Add party size range filters: 1-2, 3-4, 5+ guests
- Multi-select capability for overlapping ranges
- URL parameter: `partySizes=1-2,3-4,5+`

**Technical Approach:**

- Extend existing `useOpsBookingsTableState` hook
- Add party size conditions to Supabase query builder
- Reuse `OpsStatusFilter` component pattern

#### Time Slot Filtering

**Implementation:**

- Standard time slots: Breakfast (6-10am), Lunch (11am-3pm), Dinner (5-10pm)
- Single or multi-select based on restaurant needs
- URL parameter: `timeSlots=breakfast,lunch,dinner`

**Technical Approach:**

- Use PostgreSQL EXTRACT(HOUR) function on start_time field
- Leverage existing restaurant timezone handling
- Follow established filter component patterns

### Phase 2: Enhanced Search

#### Extended Search Capabilities

**Implementation:**

- Add booking reference number search
- Add customer phone number search
- Maintain existing name/email search functionality
- Enhanced search result highlighting

**Technical Approach:**

- Extend ILIKE query to include booking_reference and customer_phone
- Add phone number pattern validation
- Maintain existing debounced search behavior

### Phase 3: User Experience Enhancement

#### Active Filter Management

**Implementation:**

- Visual display of active filters with badges
- Individual filter clear functionality
- Clear all filters option
- Filter count indicators

**Technical Approach:**

- Create `ActiveFiltersBar` component
- Extend URL state management
- Add responsive design for mobile devices

## Technical Architecture

### Frontend Components

```
OpsBookingsClient.tsx (Enhanced)
├── OpsPartySizeFilter.tsx (New)
├── OpsTimeSlotFilter.tsx (New)
├── OpsStatusFilter.tsx (Existing)
├── ActiveFiltersBar.tsx (New)
└── SearchInput (Enhanced)
```

### State Management

- Extend existing Zustand store with new filter states
- Maintain URL synchronization for all filters
- Preserve existing filter interaction patterns

### API Extensions

- Extend Zod validation schema for new parameters
- Add conditional clauses to Supabase query builder
- Maintain backward compatibility with existing API

### Database Layer

- No schema changes required (uses existing fields)
- Leverage existing indexes on party_size and start_time
- Optimize query performance for filter combinations

## Success Metrics

### Operational Efficiency

- **Time to Find Booking**: Reduce by 40% from current baseline
- **Filter Adoption Rate**: 75% of staff using new filters within 30 days
- **Search Success Rate**: Improve from current baseline to 95%

### Performance Targets

- **Filter Response Time**: < 500ms (P95)
- **Search Response Time**: < 400ms (P95)
- **Page Load Impact**: < 100ms additional load time

### User Experience

- **Accessibility**: WCAG 2.1 AA compliance
- **Mobile Usability**: Optimized for mobile devices
- **Error Rate**: < 1% for filter operations

## Implementation Timeline

### Week 1-2: Backend Foundation

- API schema extensions
- Database query optimization
- Service layer updates
- Unit and integration tests

### Week 3-4: Frontend Implementation

- Filter component development
- State management enhancements
- UI integration and responsive design
- Component testing

### Week 5: Testing and Refinement

- E2E testing
- Performance optimization
- Accessibility validation
- User acceptance testing

### Week 6: Rollout

- Feature flag deployment
- Gradual user exposure (10% → 50% → 100%)
- Monitoring and optimization
- Documentation and training

## Risk Mitigation

### Technical Risks

- **Query Performance**: Mitigate through proper indexing and query optimization
- **UI Complexity**: Address with progressive disclosure and responsive design
- **Backward Compatibility**: Maintain existing API contracts and URL patterns

### Operational Risks

- **User Adoption**: Mitigate through intuitive design and staff training
- **System Load**: Monitor database performance during rollout
- **Bug Impact**: Use feature flags for quick rollback if needed

## Dependencies and Assumptions

### Dependencies

- Existing Supabase database schema
- Current state management infrastructure
- Existing UI component library (Shadcn)
- Current API architecture

### Assumptions

- Standard restaurant time slot definitions apply
- Party size ranges cover typical scenarios
- Existing database indexes are sufficient
- Staff have basic computer literacy

## Success Criteria

### Must-Have

- [ ] Party size filtering implemented and functional
- [ ] Time slot filtering implemented and functional
- [ ] Enhanced search includes references and phone numbers
- [ ] Multiple filters work together seamlessly
- [ ] Performance targets met
- [ ] Full accessibility compliance

### Should-Have

- [ ] Active filter management interface
- [ ] Mobile-optimized experience
- [ ] Comprehensive error handling
- [ ] Staff training materials

### Could-Have

- [ ] Filter usage analytics
- [ ] Advanced search suggestions
- [ ] Custom time slot definitions
- [ ] Filter presets for common scenarios

## Conclusion

This enhancement will significantly improve the operational efficiency of restaurant staff by providing powerful, intuitive search and filtering capabilities. The solution builds upon existing technical foundations while introducing minimal architectural changes, ensuring a reliable and maintainable implementation.

The phased approach allows for iterative improvement and risk mitigation, while the comprehensive testing strategy ensures quality and performance. The expected 40% reduction in time to find bookings will translate to improved customer service and operational efficiency.
