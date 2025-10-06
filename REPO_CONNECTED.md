# 🔌 Repository Connected to Supabase Studio

Your repository is now configured to use the local Supabase instance!

## ✅ What's Configured

### 1. Environment Variables Updated (`.env.local`)

```env
# LOCAL SUPABASE (Active)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Default Restaurant (from seeded data)
BOOKING_DEFAULT_RESTAURANT_ID=5746c074-3c20-4876-a9af-b63bb13a0772
NEXT_PUBLIC_DEFAULT_RESTAURANT_ID=5746c074-3c20-4876-a9af-b63bb13a0772
NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG=the-queen-elizabeth-pub
```

Your **production credentials** are preserved as comments - just swap them when deploying.

### 2. Default Restaurant

**The Queen Elizabeth Pub** is set as your default:

- **ID:** `5746c074-3c20-4876-a9af-b63bb13a0772`
- **Slug:** `the-queen-elizabeth-pub`
- **Capacity:** 120
- **Tables:** 12 (T1-T12)
- **Customers:** 80
- **Bookings:** 50 (15 past, 5 today, 30 future)

## 🚀 Start Development

### 1. Ensure Supabase is Running

```bash
npm run db:status
```

Expected output:

```
✅ supabase local development setup is running.
   API URL: http://127.0.0.1:54321
   Studio URL: http://127.0.0.1:54323
```

If not running:

```bash
npm run db:start
```

### 2. Start Your App

```bash
npm run dev
```

Your app will now connect to the local Supabase with all the seeded data!

### 3. Access Points

| Service             | URL                    | Purpose             |
| ------------------- | ---------------------- | ------------------- |
| **Your App**        | http://localhost:3000  | Next.js application |
| **Supabase Studio** | http://127.0.0.1:54323 | Database UI         |
| **Supabase API**    | http://127.0.0.1:54321 | REST API            |

## 🧪 Test the Connection

### Option 1: Quick API Test

```bash
# Test API connection
curl http://127.0.0.1:54321/rest/v1/ \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
```

### Option 2: Test from Your App

Create a test page at `app/test-db/page.tsx`:

```typescript
import { createClient } from '@supabase/supabase-js';

export default async function TestPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('name, capacity')
    .limit(5);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Database Connection Test</h1>
      {error ? (
        <p className="text-red-500">Error: {error.message}</p>
      ) : (
        <div>
          <p className="text-green-500">✅ Connected to Supabase!</p>
          <h2 className="text-xl mt-4 mb-2">Restaurants:</h2>
          <ul>
            {restaurants?.map((r) => (
              <li key={r.name}>{r.name} (capacity: {r.capacity})</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

Then visit: http://localhost:3000/test-db

## 📊 Available Seeded Data

You now have access to:

### 8 Restaurants

1. Old Crown Pub (100 capacity)
2. Prince of Wales Pub (130 capacity)
3. The Barley Mow Pub (105 capacity)
4. The Bell Sawtry (80 capacity)
5. The Corner House Pub (90 capacity)
6. **The Queen Elizabeth Pub** (120 capacity) ⭐ _default_
7. The Railway Pub (95 capacity)
8. White Horse Pub (110 capacity)

### Per Restaurant

- 12 tables (T1-T12)
- 80 customers
- 50 bookings (15 past, 5 today, 30 future)

### Total

- 96 tables
- 640 customers
- 400 bookings

## 🔄 Switching Environments

### Use Local Supabase (Current)

Already configured! Just ensure Supabase is running:

```bash
npm run db:start
npm run dev
```

### Switch to Production

In `.env.local`, comment out local and uncomment production:

```env
# Comment out these (local):
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Uncomment these (production):
NEXT_PUBLIC_SUPABASE_URL=https://mqtchcaavsucsdjskptc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Then restart your dev server.

## 🛠 Common Tasks

### View Data in Studio

```bash
npm run db:studio  # Opens http://127.0.0.1:54323
```

### Verify Seed Data

```bash
npm run db:verify
```

### Reset Database

```bash
npm run db:reset  # Drops all data, re-runs migrations & seeds
```

### Check Connection

```bash
npm run db:status
```

## 🎯 Next Development Steps

### 1. Test Booking Features

Navigate to your booking pages and they'll use the seeded data:

- `/reserve` - Make a booking
- Browse the 8 pubs
- View existing bookings
- Test table assignments

### 2. Build New Features

You can now:

- Query restaurants: `supabase.from('restaurants').select()`
- Fetch bookings: `supabase.from('bookings').select()`
- Create new bookings
- Update customer data
- Manage tables

### 3. Test RLS Policies

The database has Row Level Security enabled. Test with different user contexts:

```typescript
// Service role (bypasses RLS)
const supabaseAdmin = createClient(url, serviceRoleKey);

// Anon role (respects RLS)
const supabaseAnon = createClient(url, anonKey);
```

## 📚 Quick Reference

### Supabase Client (Server-side)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // For server-side
);
```

### Supabase Client (Client-side)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // For client-side
);
```

### Example Queries

```typescript
// Get all restaurants
const { data } = await supabase.from('restaurants').select('*');

// Get today's bookings for a restaurant
const { data } = await supabase
  .from('bookings')
  .select('*, customer:customers(*), table:restaurant_tables(*)')
  .eq('restaurant_id', restaurantId)
  .eq('booking_date', new Date().toISOString().split('T')[0]);

// Get available tables
const { data } = await supabase
  .from('restaurant_tables')
  .select('*')
  .eq('restaurant_id', restaurantId)
  .eq('is_active', true);
```

## 🎉 You're All Set!

Your repository is now connected to Supabase Studio with:

- ✅ Local Supabase running
- ✅ Environment variables configured
- ✅ Database seeded with test data
- ✅ Studio accessible at http://127.0.0.1:54323
- ✅ Default restaurant configured

**Start building:** `npm run dev`

---

Need help? Check:

- [supabase/README.md](./supabase/README.md) - Database documentation
- [VERIFICATION_RESULTS.md](./VERIFICATION_RESULTS.md) - What's in your database
- [DATABASE_SETUP_COMPLETE.md](./DATABASE_SETUP_COMPLETE.md) - Setup guide
