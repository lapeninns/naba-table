---
task: real-time-booking-updates
timestamp_utc: 2026-01-18T19:10:25Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: [NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN]
related_tickets: []
---

# Product Requirements Document: Real-time Booking Updates System

## 1. Overview

### 1.1 Problem Statement

The restaurant operations dashboard currently requires manual refreshes to see booking status changes, table assignments, and other real-time updates. This creates operational inefficiencies and potential conflicts when multiple staff members are managing bookings simultaneously.

### 1.2 Solution

Implement a real-time booking updates system that provides instant synchronization across all connected dashboard clients using Supabase Realtime WebSocket subscriptions with React Query cache invalidation.

### 1.3 Success Criteria

- Booking status changes appear instantly across all connected dashboard clients
- Table assignments update in real-time with optimistic UI updates
- System gracefully falls back to polling when WebSocket connections fail
- External changes trigger user notifications to avoid confusion
- Performance remains acceptable with 10+ concurrent users

## 2. User Stories

### 2.1 Core Real-time Updates

**As a restaurant operator**, I want to see booking status changes instantly across all dashboard screens so that I can coordinate with other staff members without communication delays.

**Acceptance Criteria:**

- When a booking is checked in, all connected dashboards update within 500ms
- Status changes trigger toast notifications for users not actively making the change
- Updates work for all booking lifecycle states (confirmed, seated, checked_in, completed, cancelled)

**As a restaurant operator**, I want table assignments to sync in real-time so that multiple staff members don't accidentally assign the same table to different bookings.

**Acceptance Criteria:**

- Table assignments appear immediately on all dashboards when made
- Optimistic updates provide instant UI feedback before server confirmation
- Conflicts are prevented through real-time state synchronization

### 2.2 Reliability and Performance

**As a restaurant operator**, I want the dashboard to continue working even with intermittent connectivity so that I can rely on the system during busy service periods.

**Acceptance Criteria:**

- System automatically falls back to 5-second polling when WebSocket fails
- Reconnection attempts happen automatically when connectivity is restored
- No data loss occurs during connectivity interruptions

**As a restaurant operator**, I want the system to handle high-frequency updates without performance degradation so that the dashboard remains responsive during peak hours.

**Acceptance Criteria:**

- Realtime events are throttled to 10 events per second maximum
- UI updates remain smooth with 10+ concurrent users
- Memory usage stays stable during extended operation

### 2.3 User Experience

**As a restaurant operator**, I want clear notifications when other staff members make changes so that I'm aware of external updates affecting my work.

**Acceptance Criteria:**

- Toast notifications appear for external status changes
- Notifications include booking identifier and status transition
- Notifications are suppressed for changes made by the current user

## 3. Technical Requirements

### 3.1 Real-time Infrastructure

- **Supabase Realtime**: WebSocket subscriptions to postgres_changes events
- **Event Types**: INSERT/UPDATE/DELETE on bookings, booking_table_assignments, tables
- **Channel Strategy**: Restaurant-specific channels with date filtering
- **Connection Management**: Singleton client with automatic reconnection

### 3.2 Cache Management

- **React Query**: Primary state management with optimistic updates
- **Cache Invalidation**: Targeted invalidation of affected queries
- **Background Refetch**: Automatic data refresh on real-time events
- **Conflict Resolution**: Optimistic vs actual state reconciliation

### 3.3 Fallback Mechanism

- **Feature Flag**: NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN controls real-time enablement
- **Polling Interval**: 5-second refetch when real-time disabled
- **Graceful Degradation**: Seamless transition between real-time and polling modes

### 3.4 Performance Constraints

- **Event Throttling**: Maximum 10 events per second per client
- **UI Responsiveness**: Updates within 500ms of server-side changes
- **Memory Management**: Cleanup on component unmount
- **Battery Efficiency**: Background refetch disabled for mobile devices

## 4. Architecture

### 4.1 Client-Side Components

#### useBookingRealtime Hook

- Manages WebSocket connection lifecycle
- Handles event subscriptions and cache invalidation
- Provides fallback polling mechanism
- Coordinates with booking state machine

#### Booking State Machine Context

- Tracks optimistic updates and actual state
- Prevents duplicate notifications for user-initiated changes
- Maintains booking registry for change detection
- Handles state reconciliation

#### React Query Integration

- Primary data fetching and caching layer
- Optimistic updates for table assignments
- Targeted cache invalidation strategies
- Background refetch coordination

### 4.2 Server-Side Components

#### API Endpoints

- `/api/ops/dashboard/summary` - Aggregated booking data
- `/api/ops/bookings/[id]/check-in` - Status change operations
- `/api/ops/bookings/[id]/tables` - Table assignment operations

#### Database Triggers

- Automatic postgres_changes event generation
- Real-time event broadcasting
- Change data capture for all booking-related tables

### 4.3 Data Flow

1. **User Action** → React Query mutation with optimistic update
2. **API Request** → Server-side validation and database update
3. **Database Trigger** → postgres_changes event broadcast
4. **WebSocket Event** → Client receives real-time notification
5. **Cache Invalidation** → React Query refetches fresh data
6. **State Reconciliation** → Optimistic vs actual state comparison
7. **UI Update** → Final state reflected in dashboard

## 5. Implementation Tasks

## Tasks

- [ ] Implement Supabase Realtime client configuration with singleton pattern
- [ ] Create useBookingRealtime hook with WebSocket connection management
- [ ] Set up basic event subscriptions for bookings table changes
- [ ] Implement React Query cache invalidation logic for real-time events
- [ ] Extend subscriptions to include booking_table_assignments table
- [ ] Add table assignment subscriptions with restaurant-specific filtering
- [ ] Implement optimistic updates for table assignment mutations
- [ ] Add conflict resolution for concurrent table assignments
- [ ] Integrate real-time updates with existing table assignment UI components
- [ ] Implement status change detection logic comparing previous/current states
- [ ] Add toast notification system for external booking status changes
- [ ] Integrate notifications with booking state machine for tracking
- [ ] Handle edge cases and error scenarios for status change notifications
- [ ] Implement event throttling to maximum 10 events per second per client
- [ ] Add comprehensive error handling and automatic reconnection logic
- [ ] Optimize cache invalidation strategies for performance
- [ ] Implement fallback polling mechanism when WebSocket connections fail
- [ ] Add feature flag control for enabling/disabling real-time functionality
- [ ] Create unit tests for all real-time components and hooks
- [ ] Write integration tests for WebSocket connection scenarios
- [ ] Perform performance testing with multiple concurrent users
- [ ] Conduct end-to-end testing of complete real-time update flows
- [ ] Set up real-time connection status monitoring and alerting
- [ ] Implement performance metrics collection for real-time operations
- [ ] Add error tracking and automatic reporting for real-time failures
- [ ] Create user feedback collection mechanisms for real-time features
- [ ] Update user documentation to explain real-time functionality
- [ ] Develop staff training materials for new notification system
- [ ] Create troubleshooting guides for connectivity issues
- [ ] Document best practices for multi-user coordination with real-time updates

## 6. Dependencies

### 6.1 External Dependencies

- **Supabase**: Real-time WebSocket infrastructure
- **React Query**: State management and caching
- **Next.js**: API routes and server-side logic

### 6.2 Internal Dependencies

- **Booking State Machine**: Optimistic update tracking
- **Ops Dashboard Components**: UI integration points
- **Table Assignment System**: Core business logic
- **Booking Lifecycle API**: Server-side operations

## 7. Risks and Mitigations

### 7.1 Technical Risks

- **WebSocket Connection Stability**: Implement robust reconnection logic and fallback polling
- **Performance at Scale**: Event throttling and efficient cache invalidation
- **Race Conditions**: Optimistic update reconciliation and conflict resolution

### 7.2 Business Risks

- **User Confusion**: Clear notifications and visual indicators for external changes
- **Data Consistency**: Strong conflict resolution and state synchronization
- **Adoption Barrier**: Seamless fallback to existing polling behavior

## 8. Success Metrics

### 8.1 Performance Metrics

- **Update Latency**: < 500ms from server change to UI update
- **Connection Stability**: > 99% uptime during business hours
- **Memory Usage**: Stable consumption over 8-hour shifts

### 8.2 User Experience Metrics

- **Notification Accuracy**: 100% of external changes trigger appropriate notifications
- **Conflict Reduction**: 90% reduction in table assignment conflicts
- **User Satisfaction**: Positive feedback on real-time responsiveness

### 8.3 Technical Metrics

- **Event Processing**: < 10ms average event handling time
- **Cache Hit Rate**: > 95% for frequently accessed data
- **Error Rate**: < 0.1% for real-time operations

## 9. Rollout Plan

### 9.1 Feature Flag Control

- Deploy with NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN disabled by default
- Enable for internal testing and validation
- Gradual rollout to pilot restaurants
- Full production release after validation

### 9.2 Monitoring and Observability

- Real-time connection status monitoring
- Performance metrics collection and alerting
- Error tracking and automatic reporting
- User feedback collection mechanisms

### 9.3 Training and Documentation

- Updated user documentation for real-time features
- Staff training on new notification system
- Troubleshooting guides for connectivity issues
- Best practices for multi-user coordination
