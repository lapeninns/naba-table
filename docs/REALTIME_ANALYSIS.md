# Realtime Implementation Analysis & Solutions

## Current Status

### ✅ What's Implemented

- **Technology**: Supabase Realtime (WebSocket-based)
- **Client**: `@supabase/supabase-js` v2.86.0
- **Pattern**: Postgres Changes subscription
- **Hooks Enhanced**:
  - `useOpsTodaySummary`
  - `useOpsBookingChanges`
  - `useOpsBookingHeatmap`

### ⚠️ Issues Identified

1. **Feature Flag Missing** ✅ FIXED
   - `NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN=true` was not in `.env.local`
   - **Now added** to `.env.local`

2. **Throttling Too Aggressive** ✅ FIXED
   - `eventsPerSecond: 2` → **increased to 10**
   - Was limiting to only 2 events/second (causing 500ms+ delays)

3. **Potential Supabase Configuration Issues** ⚠️ NEEDS VERIFICATION
   - Realtime must be enabled on tables in Supabase dashboard
   - RLS policies must allow reads for authenticated users
   - Publications must include the tables

## How Supabase Realtime Works

### Architecture

```
Database Change → Postgres WAL → Realtime Server → WebSocket → Client
```

### What It Uses

- **Protocol**: WebSocket (persistent bidirectional connection)
- **Mechanism**: Postgres Write-Ahead Log (WAL) streaming
- **Library**: Phoenix Channels (Elixir framework)
- **Client**: JavaScript WebSocket wrapper

### Performance Characteristics

- **Latency**: 50-200ms (local) to 200-500ms (remote)
- **Throughput**: Limited by `eventsPerSecond` config
- **Connection**: Single WebSocket for all channels
- **Overhead**: Minimal (~1-2KB per event)

## Alternative Approaches

### 1. ✅ **Supabase Realtime** (Current - RECOMMENDED)

**Pros**:

- Built-in to Supabase
- Automatic WAL streaming
- Filtered subscriptions (by column values)
- Connection pooling handled
- Free tier: 200 concurrent connections

**Cons**:

- Requires Supabase Pro for production
- Limited to Postgres changes only
- Requires RLS policies configured correctly
- Can't filter on complex queries

**Best For**:

- Real-time database changes
- Multi-tenant apps (filter by restaurant_id)
- Simple change detection

---

### 2. **Pusher** (Alternative SaaS)

**Pros**:

- Dedicated realtime infrastructure
- Better at-scale performance
- More flexible event types
- Better presence features
- Free tier: 100 connections

**Cons**:

- Additional cost ($49+/mo for production)
- Requires custom backend integration
- More setup complexity

**Best For**:

- Apps needing presence (who's online)
- Complex event routing
- Non-database events

**Implementation**:

```typescript
import Pusher from 'pusher-js';

const pusher = new Pusher(key, { cluster: 'us2' });
const channel = pusher.subscribe('restaurant-123');
channel.bind('booking-updated', (data) => {
  queryClient.invalidateQueries(['bookings']);
});
```

---

### 3. **Ably** (Alternative SaaS)

**Pros**:

- Guaranteed message delivery
- Better reliability (99.999% uptime)
- Connection state recovery
- Better presence
- Free tier: 200 connections

**Cons**:

- Cost ($29+/mo)
- Additional dependency
- More complex setup

**Best For**:

- Mission-critical realtime
- Financial/booking systems
- Need guaranteed delivery

---

### 4. **Server-Sent Events (SSE)** (Custom)

**Pros**:

- Native browser API
- Simpler than WebSocket
- Auto-reconnection
- Works through most firewalls
- Free (self-hosted)

**Cons**:

- Unidirectional only (server → client)
- Limited browser support (no IE)
- Requires custom server endpoint
- More server resources

**Implementation**:

```typescript
// Client
const events = new EventSource('/api/ops/realtime');
events.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.type === 'booking-updated') {
    queryClient.invalidateQueries(['bookings']);
  }
};

// Server (Next.js Route Handler)
export async function GET(req: Request) {
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: any) => {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Subscribe to DB changes
      const subscription = supabase
        .channel('bookings')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, send)
        .subscribe();

      req.signal.addEventListener('abort', () => {
        subscription.unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

---

### 5. **Polling with SWR/React Query** (Fallback - Current Fallback)

**Pros**:

- Simple implementation
- No WebSocket overhead
- Works everywhere
- Already implemented

**Cons**:

- Not real-time (5-60s delay)
- Higher server load
- More bandwidth usage
- Stale data windows

**Current Settings**:

- Summary: 60s stale time
- Changes: 60s refetch interval
- Heatmap: 5min stale time

---

### 6. **WebSockets (Custom)** (Advanced)

**Pros**:

- Full control
- Bidirectional
- Custom event types
- No third-party dependency

**Cons**:

- Must implement server
- Connection management complexity
- Scaling challenges
- Deployment complexity (needs sticky sessions)

**Not Recommended** - Use Supabase Realtime instead

---

## Recommended Solution: FIX CURRENT IMPLEMENTATION

### Why Stick with Supabase Realtime?

1. ✅ Already integrated
2. ✅ Free on current plan
3. ✅ Minimal latency (100-300ms)
4. ✅ Automatic filtering by restaurant_id
5. ✅ Built-in reconnection logic
6. ✅ No additional infrastructure

### What Needs to be Done

#### 1. ✅ Enable Feature Flag (DONE)

```bash
NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN="true"
```

#### 2. ✅ Increase Event Throttle (DONE)

```typescript
eventsPerSecond: 10; // Was 2
```

#### 3. ⚠️ Verify Supabase Configuration

**Check in Supabase Dashboard** → Database → Replication:

**Required Publications**:

```sql
-- Ensure these tables are in the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE booking_table_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE booking_history;
ALTER PUBLICATION supabase_realtime ADD TABLE customer_profiles;
```

**Check Current Publications**:

```sql
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

#### 4. ⚠️ Verify RLS Policies

Realtime requires RLS policies that allow SELECT:

```sql
-- Example: Bookings RLS policy
CREATE POLICY "Users can view bookings for their restaurants"
ON bookings FOR SELECT
USING (
  restaurant_id IN (
    SELECT restaurant_id
    FROM restaurant_memberships
    WHERE user_id = auth.uid()
  )
);
```

**Check Policies**:

```sql
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('bookings', 'booking_table_assignments', 'booking_history');
```

#### 5. Add Diagnostics Component

Create a realtime status indicator:

```tsx
// src/components/features/dashboard/RealtimeStatus.tsx
'use client';

import { useRealtimeDiagnostics } from '@/hooks/ops/useRealtimeDiagnostics';

export function RealtimeStatus() {
  const status = useRealtimeDiagnostics();

  if (!status.enabled) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`px-3 py-2 rounded-lg text-xs font-medium ${
          status.connected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status.connected ? 'bg-white animate-pulse' : 'bg-white/50'
            }`}
          />
          {status.connected ? 'Live' : 'Offline'}
          {status.channels > 0 && ` • ${status.channels} channels`}
        </div>
        {status.error && <div className="text-xs mt-1 opacity-75">{status.error}</div>}
      </div>
    </div>
  );
}
```

Add to dashboard:

```tsx
// OpsDashboardClient.tsx
import { RealtimeStatus } from './RealtimeStatus';

// In render
return (
  <div>
    <RealtimeStatus />
    {/* rest of dashboard */}
  </div>
);
```

## Testing the Fix

### 1. Verify Feature Flag

```bash
# Check it's enabled
grep REALTIME .env.local
# Should show: NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN="true"
```

### 2. Restart Dev Server

```bash
pnpm run dev
```

### 3. Check Browser Console

Should see logs:

```
[realtime] Dashboard summary subscribed for restaurant abc-123
[realtime] Booking changes feed subscribed for restaurant abc-123
[realtime] Heatmap subscribed for restaurant abc-123
```

### 4. Test Two-Tab Update

1. Open dashboard in Tab A
2. Open dashboard in Tab B (same restaurant)
3. In Tab B: Check in a booking
4. In Tab A: Should update within 500ms

### 5. Check Network Tab

- Should see WebSocket connection to Supabase
- URL: `wss://<your-project-ref>.supabase.co/realtime/v1/websocket`
- Status: 101 Switching Protocols

## Performance Tuning

### If Still Slow

1. **Increase throttle further**:

```typescript
eventsPerSecond: 20; // or even 50
```

2. **Debounce invalidations** (prevent refetch spam):

```typescript
const debouncedInvalidate = debounce(() => {
  queryClient.invalidateQueries({ queryKey });
}, 300); // Wait 300ms before refetching
```

3. **Optimistic updates** (update UI immediately):

```typescript
onMutate: async (newData) => {
  await queryClient.cancelQueries({ queryKey });
  const previous = queryClient.getQueryData(queryKey);
  queryClient.setQueryData(queryKey, (old) => ({
    ...old,
    bookings: [...old.bookings, newData],
  }));
  return { previous };
};
```

## Migration Path (If Needed)

If Supabase Realtime proves insufficient:

**Phase 1**: Current (Supabase Realtime)  
**Phase 2**: Add SSE for critical updates  
**Phase 3**: Move to Pusher/Ably for scale

## Cost Analysis

| Solution          | Free Tier       | Production Cost | Latency      |
| ----------------- | --------------- | --------------- | ------------ |
| Supabase Realtime | 200 connections | $25/mo (Pro)    | 100-300ms    |
| Pusher            | 100 connections | $49/mo          | 50-150ms     |
| Ably              | 200 connections | $29/mo          | 50-150ms     |
| SSE (self-hosted) | Unlimited       | Server costs    | 50-200ms     |
| Polling           | Unlimited       | Server costs    | 5000-60000ms |

## Conclusion

**RECOMMENDATION**: Stick with Supabase Realtime after fixing:

1. ✅ Feature flag enabled
2. ✅ Throttle increased (2 → 10 events/sec)
3. ⚠️ Verify Supabase config (publications + RLS)
4. ⚠️ Add diagnostics component
5. ⚠️ Test with two tabs

**Expected Result**: 100-500ms latency for updates (acceptable for booking system)

**Fallback**: If issues persist, implement SSE or consider Pusher for production.
