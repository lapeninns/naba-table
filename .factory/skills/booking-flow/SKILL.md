---
name: Booking Flow
description: Guidelines for implementing and modifying the guest booking flow, including capacity checks, table assignment, and confirmation emails.
triggers:
  - booking
  - reservation
  - capacity
  - table assignment
---

# Booking Flow Skill

This skill provides guidance for working with the guest booking flow in the Nab a Table platform.

## Overview

The booking flow consists of:

1. Restaurant selection
2. Date and party size selection
3. Time slot availability check
4. Soft hold creation (5-minute TTL)
5. Guest details collection
6. Booking confirmation with table assignment
7. Confirmation email

## Key Files

| Component        | Location                              |
| ---------------- | ------------------------------------- |
| Booking API      | `src/app/api/bookings/route.ts`       |
| Capacity Planner | `server/capacity/`                    |
| Table Assignment | `server/capacity/table-assignment/`   |
| Booking Service  | `server/bookings.ts`                  |
| Email Jobs       | `server/jobs/booking-side-effects.ts` |

## Business Rules

### Capacity Rules

- Maximum 3 tables can be combined for a single booking
- Tables must be adjacent for merging
- Soft holds expire after 5 minutes
- Service periods define available time slots

### Table Assignment

- Scoring algorithm considers: capacity fit, adjacency, zone matching
- Fixed tables cannot be merged
- Movable tables require adjacency for combination

### Validation

- Party size must be within restaurant limits
- Booking time must be within operating hours
- Contact details (email, phone) are validated

## Common Tasks

### Adding a New Validation Rule

1. Add rule to `server/bookings/validation.ts`
2. Add error type to `lib/enums.ts`
3. Update API route error handling
4. Add user-facing message in reserve widget

### Modifying Table Assignment Logic

1. Review `server/capacity/table-assignment/scoring.ts`
2. Add/modify scoring factors
3. Test with various party sizes
4. Verify edge cases (single table, max combination)

### Adding Email Notifications

1. Create template in `server/emails/templates/`
2. Add job handler in `server/jobs/`
3. Enqueue from booking side-effects
4. Test with `pnpm email:preview`

## Testing Checklist

- [ ] Single guest booking
- [ ] Party at max table capacity
- [ ] Party requiring table combination
- [ ] Soft hold expiration
- [ ] Concurrent booking attempts
- [ ] Email delivery verification
