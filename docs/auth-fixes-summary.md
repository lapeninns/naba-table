# Authentication & Authorization Fixes - Summary

## Overview

This document summarizes all the changes made to fix authentication and authorization issues across the application, particularly focusing on the separation between guest-facing and restaurant-facing pages.

## Issues Fixed

### 1. ✅ Restaurant Routes Showing Sidebar for Unauthenticated Users

**Problem:** The sidebar was visible to unauthenticated users trying to access restaurant-facing pages.

**Solution:**

- Moved restaurant sign-in to `/app/auth/signin` outside of the `(app)` route group
- Added authentication check to `/app/(app)/layout.tsx` that redirects unauthenticated users to `/app/auth/signin`
- Now the layout only renders OpsShell when a user is authenticated

**Files Changed:**

- `/src/app/app/(app)/layout.tsx` - Added redirect for unauthenticated users
- `/src/app/app/auth/signin/page.tsx` - Ops login page

### 2. ✅ Redundant Auth Checks on Individual Pages

**Problem:** Some pages had duplicate authentication checks that are now unnecessary.

**Solution:**

- Removed redundant auth check from `/app/page.tsx` (dashboard)
- Authentication is now centrally managed by the layout

**Files Changed:**

- `/src/app/app/(app)/page.tsx` - Removed duplicate auth check

### 3. ✅ Guest Sign-In Page Not Redirecting Authenticated Users

**Problem:** Authenticated users could land on the guest sign-in page unnecessarily.

**Solution:**

- Added authentication check to `/auth/signin` page
- Redirects authenticated users to their intended destination or `/guest/dashboard`

**Files Changed:**

- `/src/app/auth/signin/page.tsx` - Added auth check and redirect

## Changes Summary

### File Structure Changes

```
Before:
/src/app/app/(app)/
  ├── login/
  │   └── page.tsx
  ├── dashboard/
  ├── bookings/
  └── ...

After:
/src/app/app/
  ├── (app)/          # Protected - requires auth
  │   ├── dashboard/
  │   ├── bookings/
  │   └── ...
  └── auth/
      └── signin/     # Unprotected entry point for ops sign-in
```

### Code Changes

#### 1. `/src/app/app/(app)/layout.tsx`

```typescript
// Added redirect for unauthenticated users
if (!supabaseUser) {
  redirect('/app/auth/signin');
}
```

#### 2. `/src/app/app/(app)/page.tsx`

```typescript
// Removed redundant auth check - now handled by layout
// Before: Had getUser() call and redirect
// After: Auth handled by layout
```

#### 3. `/src/app/auth/signin/page.tsx`

```typescript
// Added redirect for authenticated users
const supabase = await getServerComponentSupabaseClient();
const {
  data: { user },
} = await supabase.auth.getUser();

if (user) {
  const redirectTarget = redirectedFromParam ?? '/guest/dashboard';
  redirect(redirectTarget);
}
```

## Route Protection Summary

### Restaurant-Facing Routes (app.nabatable.com)

#### ✅ Protected Routes

All routes under `/app/(app)/*` now automatically require authentication via layout:

- `/app` (Dashboard)
- `/app/dashboard`
- `/app/bookings`
- `/app/walk-in`
- `/app/customers`
- `/app/analytics`
- `/app/analytics/rejections`
- `/app/seating`
- `/app/seating/capacity`
- `/app/seating/floor-plan`
- `/app/management`
- `/app/management/team`
- `/app/settings/**`

**Redirect:** Unauthenticated users → `/app/auth/signin`

#### ✅ Unprotected Routes

- `/app/auth/signin` - Restaurant staff login (redirects if already authenticated)

### Guest-Facing Routes (nabatable.com)

#### ✅ Protected Routes

- `/guest/dashboard` - Has auth check → `/auth/signin?redirectedFrom=/guest/dashboard`
- `/guest/profile` - Has auth check → `/auth/signin?redirectedFrom=/guest/profile`
- `/guest/bookings` - Has auth check → `/auth/signin?redirectedFrom=/guest/bookings`

#### ✅ Partially Protected Routes

- `/bookings/[bookingId]` - Requires auth OR token

#### ✅ Unprotected Routes (Public)

- `/` - Landing page
- `/auth/signin` - Guest login (redirects if already authenticated)
- `/restaurants/[slug]` - Restaurant detail
- `/restaurants/[slug]/book` - Booking wizard
- `/restaurants/[slug]/book/thank-you` - Thank you page
- `/bookings/[bookingId]/thank-you` - Booking confirmation

## Testing Checklist

### Restaurant-Facing Routes

- [x] Build succeeds without errors
- [ ] Unauthenticated user accessing `/app` → redirects to `/app/auth/signin`
- [ ] Unauthenticated user accessing `/app/dashboard` → redirects to `/app/auth/signin`
- [ ] Unauthenticated user accessing `/app/bookings` → redirects to `/app/auth/signin`
- [ ] Authenticated restaurant user accessing `/app/auth/signin` → redirects to `/app`
- [ ] Sidebar is NOT visible for unauthenticated users
- [ ] Sidebar IS visible for authenticated users

### Guest-Facing Routes

- [ ] Unauthenticated user accessing `/guest/dashboard` → redirects to `/auth/signin?redirectedFrom=/guest/dashboard`
- [ ] Authenticated guest accessing `/auth/signin` → redirects to `/guest/dashboard`
- [ ] Authenticated guest accessing `/auth/signin?redirectedFrom=/guest/profile` → redirects to `/guest/profile`
- [ ] Public routes remain accessible to everyone

### Cross-Domain

- [ ] Test subdomain routing works correctly (app.nabatable.com redirects properly)
- [ ] CSRF cookies work across subdomains
- [ ] Auth sessions persist across subdomains

## Benefits

1. **Centralized Auth:** Restaurant-facing pages now have centralized auth management through the layout
2. **Better UX:** Users are redirected to appropriate pages based on their auth state
3. **Cleaner Code:** Removed duplicate auth checks from individual pages
4. **Secure by Default:** All new pages under `(app)` route group automatically require authentication
5. **Clear Separation:** Login page is clearly separated from protected pages in the file structure

## Next Steps

1. Test all routes manually to ensure proper redirects
2. Add automated tests for auth flows
3. Monitor for any edge cases in production
4. Consider adding role-based access control for different restaurant staff roles

## Notes

- The `/app/auth/signin` page has auth checks and redirects in place.
- Guest pages (`/guest/*`) already had proper individual auth checks and were left as-is
- The proxy handles subdomain routing and is unaffected by these changes
