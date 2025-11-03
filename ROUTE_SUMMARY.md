# SajiloReserveX Route Mapping Summary

## Quick Overview

**Total Routes**: 105  
**Pages**: 31  
**API Endpoints**: 74  
**Framework**: Next.js 15 App Router

## Route Categories

### 🌐 Public Pages (25 routes)

- Homepage, marketing pages (about, pricing, blog)
- Restaurant browsing and reservation flow
- Authentication pages (signin, signup)
- Legal pages (privacy, terms)

### 🔐 Authenticated Pages (6 routes)

- **Customer Area**: `/my-bookings`, `/profile/manage`
- **Admin Console**: `/ops/*` (bookings, tables, team, settings)

### 📡 API Endpoints (74 routes)

#### Core APIs (15 routes)

- Bookings CRUD with advanced operations
- Restaurant data and schedules
- User profile management
- Authentication callbacks

#### Operations Console APIs (32 routes)

- Dashboard analytics and reporting
- Advanced booking management (check-in, no-show)
- Customer and table management
- Strategic settings and simulations

#### Management APIs (12 routes)

- **Owner API**: Team management, restaurant configuration
- **Staff API**: Manual/auto booking operations

#### Legacy/Test APIs (15 routes)

- Versioned v1 API for backward compatibility
- Development and testing endpoints

## Security Architecture

- **Route Groups**: `(authed)` for users, `(ops)` for admins
- **No explicit middleware**: Relies on Next.js route group conventions
- **API Security**: No visible authentication patterns in route structure

## Dynamic Routing Patterns

### Pages

- Blog: `/:articleId`, `/author/:authorId`, `/category/:categoryId`
- Restaurants: `/:slug`, `/reserve/:reservationId`
- Invitations: `/invite/:token`

### APIs

- Resources: `/:id` (bookings, restaurants, tables)
- Nested: `/bookings/:id/tables/:tableId`
- Actions: `/bookings/:id/check-in`, `/invitations/:token/accept`

## HTTP Method Distribution

| Method | Count | Usage                    |
| ------ | ----- | ------------------------ |
| GET    | 57    | Data retrieval, listings |
| POST   | 38    | Creation, actions        |
| DELETE | 15    | Deletion                 |
| PUT    | 12    | Full updates             |
| PATCH  | 8     | Partial updates          |

## Key Insights

1. **Comprehensive Operations**: The ops console has extensive APIs for restaurant management
2. **Versioned API**: Maintains backward compatibility with `/api/v1` endpoints
3. **Rich Booking Flow**: Multiple booking-related endpoints for complex scenarios
4. **Team Management**: Complete invitation and membership system
5. **Testing Infrastructure**: Dedicated test endpoints for development

## Files Generated

- `COMPLETE_ROUTE_MAP.md` - Full documentation with all formats
- `route-map-ascii.txt` - ASCII tree view
- `route-map-mermaid.md` - Mermaid diagram for documentation
- `route-map.json` - Machine-readable complete data
- `route-scanner.js` - Automated scanning tool

_Scan completed: 2025-11-03T16:42:32.522Z_
