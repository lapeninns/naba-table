# Authentication & Authorization Routes

This document categorizes all application routes by their authentication requirements and provides a clear overview of protected vs. unprotected pages.

## Route Categories

### 1. Restaurant-Facing Routes (app.nabatable.com)

#### Protected Routes (Require Restaurant Staff Authentication)

All routes under `/app/(app)/*` except `/app/auth/signin`:

- `/` (Dashboard home) - **NEEDS FIX**
- `/dashboard` - ✅ Has auth check
- `/bookings` - **NEEDS FIX**
- `/walk-in` - **NEEDS FIX**
- `/customers` - **NEEDS FIX**
- `/analytics` - **NEEDS FIX**
- `/analytics/rejections` - **NEEDS FIX**
- `/seating` - **NEEDS FIX**
- `/seating/capacity` - **NEEDS FIX**
- `/seating/floor-plan` - **NEEDS FIX**
- `/management` - **NEEDS FIX**
- `/management/team` - **NEEDS FIX**
- `/settings` - **NEEDS FIX**
- `/settings/restaurant` - **NEEDS FIX**
- `/settings/restaurant/profile` - **NEEDS FIX**
- `/settings/restaurant/operating-hours` - **NEEDS FIX**
- `/settings/restaurant/service-periods` - **NEEDS FIX**
- `/settings/restaurant/occasions` - **NEEDS FIX**
- `/settings/restaurant/team` - **NEEDS FIX**
- `/settings/tables` - **NEEDS FIX**

**Redirect target when unauthenticated:** `/app/auth/signin?redirectedFrom=<current-path>`

#### Unprotected Routes

- `/app/auth/signin` - Login page (redirects to `/app` if already authenticated)

---

### 2. Guest-Facing Routes (nabatable.com)

#### Protected Routes (Require Guest Authentication)

- `/guest/dashboard` - ✅ Has auth check → `/auth/signin?redirectedFrom=/guest/dashboard`
- `/guest/profile` - ✅ Has auth check → `/auth/signin?redirectedFrom=/guest/profile`
- `/guest/bookings` - ✅ Has auth check → `/auth/signin?redirectedFrom=/guest/bookings`
- `/guest/bookings/[bookingId]` - **NEEDS VERIFICATION**

#### Partially Protected Routes

- `/bookings/[bookingId]` - ✅ Requires auth OR token → `/auth/signin?redirectedFrom=/bookings/[bookingId]`

#### Unprotected Routes (Public Access)

- `/` - Landing page
- `/auth/signin` - Guest login (should redirect if already authenticated)
- `/restaurants` - Restaurant listing (if exists)
- `/restaurants/[slug]` - Restaurant detail
- `/restaurants/[slug]/book` - Booking wizard (public, but may offer auth benefits)
- `/restaurants/[slug]/book/thank-you` - Thank you page
- `/bookings/[bookingId]/thank-you` - Booking confirmation
- `/(marketing)/item/[slug]` - Marketing page
- `/(marketing)/thank-you` - Marketing thank you page

---

## Current Issues

### Issue 1: Restaurant Routes Show Sidebar for Unauthenticated Users

**Problem:** The `/app/(app)/layout.tsx` loads the OpsShell sidebar even when there's no authenticated user. It passes `null` user to the context, but doesn't redirect.

**Impact:**

- Unauthenticated users can see the sidebar navigation
- They can try to access protected pages
- Only some pages (like `/app/page.tsx`) have individual auth checks

**Solution:** Add authentication check to `/app/(app)/layout.tsx` to redirect unauthenticated users to `/app/auth/signin`

### Issue 2: Missing Auth Checks on Individual Restaurant Pages

**Problem:** Most pages under `/app/(app)/*` don't have individual auth checks. They rely on the layout, which currently doesn't enforce authentication.

**Impact:**

- Unauthenticated users can potentially access protected pages
- Inconsistent auth behavior across the application

**Solution:** Add auth checks to layout (preferred) or individual pages

### Issue 3: Login Pages Don't Redirect Authenticated Users

**Problem:**

- `/app/auth/signin` checks auth and redirects ✅
- `/auth/signin` does NOT check if user is already authenticated

**Impact:**

- Authenticated users can land on login pages unnecessarily
- Poor user experience

**Solution:** Add auth checks to `/auth/signin` to redirect authenticated users

---

## Authentication Implementation Pattern

### For Protected Restaurant Pages:

```typescript
import { redirect } from 'next/navigation';
import { getServerComponentSupabaseClient } from '@/server/supabase';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';

export default async function ProtectedPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(withRedirectedFrom('/app/auth/signin', '/app/current-path'));
  }

  // Page content
}
```

### For Protected Guest Pages:

```typescript
import { redirect } from 'next/navigation';
import { getServerComponentSupabaseClient } from '@/server/supabase';

export default async function ProtectedGuestPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/signin?redirectedFrom=/guest/current-path');
  }

  // Page content
}
```

### For Login Pages (Redirect if Authenticated):

```typescript
import { redirect } from 'next/navigation';
import { getServerComponentSupabaseClient } from '@/server/supabase';

export default async function LoginPage({ searchParams }) {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectTarget = searchParams?.redirectedFrom ?? '/default-path';

  if (user) {
    redirect(redirectTarget);
  }

  // Login form
}
```

---

## Recommended Fixes Priority

1. **HIGH:** Fix `/app/(app)/layout.tsx` to redirect unauthenticated users
2. **HIGH:** Fix `/auth/signin` to redirect authenticated users
3. **MEDIUM:** Add auth checks to individual restaurant pages (as backup)
4. **LOW:** Verify guest booking routes have proper auth

---

## Testing Checklist

After implementing fixes, test:

- [ ] Unauthenticated user accessing `/app/dashboard` → redirects to `/app/auth/signin?redirectedFrom=/app/dashboard`
- [ ] Unauthenticated user accessing `/app/bookings` → redirects to `/app/auth/signin?redirectedFrom=/app/bookings`
- [ ] Authenticated restaurant user accessing `/app/auth/signin` → redirects to `/app`
- [ ] Authenticated guest accessing `/auth/signin` → redirects to intended page or `/guest/dashboard`
- [ ] Sidebar is NOT visible for unauthenticated users on restaurant routes
- [ ] Guest protected routes still work correctly
- [ ] Public routes remain accessible to everyone
