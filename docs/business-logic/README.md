# Business Logic Documentation

This directory contains comprehensive business logic documentation for the SajiloReserveX reservation system.

## Documents

### [Table Assignment Business Logic](./TABLE_ASSIGNMENT_BUSINESS_LOGIC.md)

**Status**: ✅ Complete  
**Last Updated**: 2025-11-13  
**Version**: 1.0

Comprehensive documentation of the table assignment system, including:

- **Core Concepts**: Assignments vs Allocations, Time Windows, Holds, Merge Groups
- **Assignment Strategies**: 5 intelligent strategies (Optimal Fit, Adjacency, Zone Preference, Load Balancing, Historical)
- **Business Rules**: Capacity matching, temporal exclusivity, adjacency requirements, zone consistency, idempotency
- **Data Model**: Complete schema documentation with table relationships
- **API Endpoints**: REST API documentation with request/response examples
- **Error Handling**: Comprehensive error types and retry strategies
- **Examples**: Real-world scenarios with code samples
- **Testing**: Unit, integration, and E2E test examples

**Key Features Documented**:

- Smart table selection algorithms
- Multi-table merge group management
- Policy drift detection and recovery
- Idempotent assignment operations
- Temporal overlap prevention
- Adjacency graph validation

---

## Quick Reference

### Assignment Flow Overview

```
1. Quote Tables     → Smart engine evaluates strategies
2. Create Hold      → Temporary table reservation (5 min TTL)
3. Validate Policy  → Check for drift (zones/adjacency/policy)
4. Confirm Hold     → Atomic assignment + allocation creation
5. Release Hold     → Cleanup temporary reservation
```

### Core Tables

- `booking_table_assignments` — Booking ↔ Table relationships
- `allocations` — Resource reservations (temporal exclusivity)
- `table_holds` — Temporary pre-assignment reservations
- `table_adjacency` — Table connectivity graph
- `booking_assignment_idempotency` — Idempotency ledger

### Key Business Rules

1. **Capacity**: `totalCapacity ≥ partySize` (slack ≤ 30% preferred)
2. **Exclusivity**: No overlapping allocations per table (GiST constraint)
3. **Adjacency**: Multi-table assignments must be connected (when required)
4. **Zone**: All tables in merge group must be in same zone
5. **Idempotency**: Deterministic keys based on `booking + tables + window + policy`

---

## Contributing

When adding new business logic documentation:

1. Follow the template structure from `TABLE_ASSIGNMENT_BUSINESS_LOGIC.md`
2. Include:
   - Overview and objectives
   - Core concepts with examples
   - Business rules with validation logic
   - Data model diagrams
   - API documentation
   - Error scenarios
   - Test examples
3. Update this index with a summary
4. Link to related code files
5. Add migration history if applicable

---

## Related Documentation

- [AGENTS.md](../../AGENTS.md) — Development workflow and SDLC
- [DOCUMENTATION.md](../../DOCUMENTATION.md) — Project overview
- [Database Migrations](../../supabase/migrations/) — Schema evolution
- [API Routes](../../src/app/api/) — REST endpoint implementations
- [Server Logic](../../server/) — Business logic implementations

---

**Maintained by**: Engineering Team  
**Review Cycle**: Quarterly  
**Questions?**: Create an issue or contact the maintainers
