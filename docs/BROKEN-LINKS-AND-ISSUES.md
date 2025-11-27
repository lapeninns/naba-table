# 🚨 Broken Redirects, CTAs & Issues - Complete Audit

**Generated**: 2025-11-27  
**Status**: Complete Inventory

---

## 1. CRITICAL REDIRECT ISSUES

### 1.1 Broken `/dashboard` Link

**Severity**: 🔴 CRITICAL  
**Location**: `/src/app/app/(app)/settings/error.tsx:27`

```tsx
<Link href="/dashboard">
  <Button variant="outline">Go to dashboard</Button>
</Link>
```

**Problem**: Route `/dashboard` does not exist. Should redirect to `/app/app` or `/app/analytics`.

**Impact**: Error page CTA is broken. Users can't navigate back from error state.

**Fix**:

```tsx
<Link href="/app">
  <Button variant="outline">Go to dashboard</Button>
</Link>
```

---

### 1.2 Subdomain Routing 404 on `app.nabatable.com`

**Severity**: 🔴 CRITICAL  
**Location**: Middleware + routing configuration

**Problem**:

- `app.nabatable.com/walk-in` returns **404**
- `app.nabatable.com/app/walk-in` works but shouldn't require `/app` prefix
- Documented in `/docs/production-readiness-checklist.md` (line 205)

**Status**: Partially fixed with new routing in `src/middleware.ts`

**Required Action**:

1. Verify middleware redirects are correctly removing duplicate `/app` prefix
2. Test on staging: `app.nabatable.com/walk-in` (should NOT 404)
3. Verify backward compatibility for old links with `/app/app/*`

**Files to Check**:

- `src/middleware.ts` (cookie domain, redirect logic)
- `src/app/api/auth/callback/route.ts` (post-auth redirect handling)

---

### 1.3 Unimplemented Redirect After Auth Callback

**Severity**: 🟠 HIGH  
**Location**: `/src/app/api/auth/callback/route.ts`

```ts
console.log('Default redirect to /app/dashboard');
// This log indicates the actual redirect might not be working
```

**Problem**: After OAuth callback, users might be redirected to non-existent `/app/dashboard`.

**Files Affected**:

- `/src/app/api/auth/callback/route.ts`
- `/src/app/api/auth/signin/route.ts` (has `sanitizeRedirect` function)

**Fix Needed**: Validate all post-auth redirects use actual routes:

- ✅ `/app` (dashboard)
- ✅ `/app/analytics`
- ✅ `/guest/dashboard`
- ❌ `/dashboard` (does not exist)
- ❌ `/app/dashboard` (does not exist)

---

## 2. BROKEN CTA (Call-To-Action) BUTTONS

### 2.1 Error Page CTA

**Location**:

- `/src/app/error.tsx:19` — `<a href="/guest/dashboard">`
- `/src/app/app/(app)/settings/error.tsx:27` — `href="/dashboard"`
- `/src/app/guest/error.tsx:27` — `href="/guest/bookings"` ✅ (valid)

**Status**:

- ✅ Guest error page works: `/guest/bookings` exists
- ❌ Root error page: `/guest/dashboard` needs validation
- ❌ Settings error page: `/dashboard` **BROKEN** (should be `/app`)

---

### 2.2 Not Found Page CTA

**Location**: `/src/app/not-found.tsx:8`

```tsx
<a href="/guest/dashboard">Back to home</a>
```

**Status**: Route exists ✅, but should also provide link to `/app` for logged-in users.

**Recommendation**: Add logic to detect user role and show appropriate CTA:

```tsx
const isAdmin = await checkAdminAuth(); // pseudocode
const href = isAdmin ? '/app' : '/guest/dashboard';
```

---

### 2.3 Sign-In Form CTA Links

**Location**: `/src/components/auth/SignInForm.tsx`

```tsx
href = '/auth/signup'; // ✅ Check if route exists
href = '/auth/forgot-password'; // ✅ Check if route exists
```

**Status**: Need to verify both routes exist.

---

### 2.4 Home Page CTAs

**Location**: `/src/app/page.tsx`

```tsx
// Lines 41-46: Book button
<Link href={bookingPath}>
  <Button>Book a table</Button>
</Link>

// Lines 47-55: Sign in button
<Link href="/auth/signin">
  <Button>Sign in to manage</Button>
</Link>

// Line 151: Another book CTA
href="/guest/bookings"

// Lines 143-150: Book CTA
href={bookingPath}

// Line 166: Sign in CTA
href="/auth/signin"

// Line 174: Dashboard CTA
href="/guest/dashboard"
```

**Status**: Mostly valid, but `bookingPath` construction needs verification. Check:

- Does booking path resolve correctly for all restaurants?
- `/guest/bookings` ✅ (exists)
- `/auth/signin` ✅ (exists)
- `/guest/dashboard` ✅ (exists)

---

## 3. UNIMPLEMENTED ROUTES

### Routes Referenced But Not Confirmed Implemented

| Route                   | Used In            | Status       | Type     |
| ----------------------- | ------------------ | ------------ | -------- |
| `/auth/signup`          | SignInForm.tsx     | ⚠️ Unknown   | CTA      |
| `/auth/forgot-password` | SignInForm.tsx     | ⚠️ Unknown   | CTA      |
| `/auth/signin`          | Multiple           | ✅ Confirmed | Link     |
| `/guest/dashboard`      | Multiple           | ✅ Confirmed | Link     |
| `/guest/bookings`       | Multiple           | ✅ Confirmed | Link     |
| `/app`                  | Fallback           | ✅ Confirmed | Link     |
| `/app/analytics`        | Navigation         | ✅ Confirmed | Link     |
| `/app/walk-in`          | WalkInWizard       | ✅ Confirmed | Link     |
| `/app/bookings`         | Multiple           | ✅ Confirmed | Link     |
| `/dashboard`            | Settings error     | ❌ MISSING   | CTA      |
| `/app/dashboard`        | Auth callback test | ❌ MISSING   | Redirect |

---

## 4. REDIRECT CHAINS & LOGIC ISSUES

### 4.1 Complex Redirect Logic in Auth Flow

**Location**: `/src/app/api/auth/signin/route.ts`

```ts
function sanitizeRedirect(target: string | undefined): string | undefined {
  // Validates and sanitizes redirect URLs
  // But doesn't handle all edge cases
}
```

**Issues**:

- ❌ Doesn't prevent redirects to non-existent routes
- ❌ No validation that target route exists
- ❌ Could redirect to invalid URLs after auth

**Recommendation**: Add route validation:

```ts
const VALID_REDIRECTS = ['/app', '/app/analytics', '/guest/dashboard', '/guest/bookings'];

function isValidRedirect(url: string): boolean {
  return VALID_REDIRECTS.some((r) => url.startsWith(r));
}
```

---

### 4.2 Sign-in Page Redirect Logic

**Location**: `/src/app/app/auth/signin/page.tsx:37`

```ts
redirect(redirectTarget);
```

**Problem**: If `redirectTarget` is invalid (e.g., `/dashboard`), it will 404 after auth.

---

### 4.3 Management Page Incorrect Redirect

**Location**: `/src/app/app/(app)/management/team/page.tsx:11`

```ts
redirect('/settings/restaurant/team');
```

**Problem**: Should be `/app/settings/restaurant/team` (missing `/app` prefix).

**Status**: ⚠️ This redirect uses relative path without `/app` which may cause issues.

---

## 5. POTENTIAL ROUTING ISSUES

### 5.1 Duplicate Path Handling in Middleware

**Location**: `src/middleware.ts`

**Current Logic**:

```
If on app.nabatable.com/app/*, remove duplicate /app prefix
```

**Issue**: What if a legitimate route is `/app/app/*` (e.g., for an app management section)?

**Status**: Documented as backward compatible, but needs testing.

---

### 5.2 Auth Callback Default Fallback

**Location**: `/src/app/api/auth/callback/route.ts`

```ts
const redirectUrl = /* some logic */;
// If redirectUrl is invalid, fallback is...?
```

**Issue**: No clear fallback if redirect URL is malformed.

---

## 6. MISSING ROUTES - ACTION REQUIRED

### Routes That Should Exist But Not Confirmed

1. **`/auth/signup`** — Linked from sign-in form
   - Check: `/src/app/auth/signup/page.tsx` exists?
2. **`/auth/forgot-password`** — Linked from sign-in form
   - Check: `/src/app/auth/forgot-password/page.tsx` exists?

3. **`/bookings/[bookingId]`** — User visits booking links
   - Check: `/src/app/bookings/[bookingId]/page.tsx` exists?
   - Confirmed ✅ (also has thank-you subpage)

4. **`/bookings/[bookingId]/thank-you`** — Post-booking confirmation
   - Check: exists?
   - Confirmed ✅

---

## 7. WINDOW.LOCATION & MANUAL NAVIGATION

### 7.1 Manual Page Reloads Instead of Navigation

**Locations**:

- `/src/components/features/booking/list/BookingListClient.tsx:76`
- `/src/components/features/guest/dashboard/GuestDashboardClient.tsx:135`

```tsx
<Button onClick={() => window.location.reload()}>
```

**Issue**: Causes full page reload instead of React navigation. Bad UX.

**Fix**: Use router instead:

```tsx
const router = useRouter();
<Button onClick={() => router.refresh()}>
```

---

### 7.2 Window.location.origin for Building URLs

**Locations**:

- `/src/components/features/guest/dashboard/GuestDashboardClient.tsx:78, 99`

```ts
const url = `${window.location.origin}/bookings/${primaryBooking.id}`;
```

**Issue**: Uses runtime origin (good for SSR), but verify it handles subdomain correctly.

---

## 8. TEST ENDPOINT GUARDS

**Severity**: 🟠 HIGH

### Confirmed Test Endpoints:

- ✅ `/api/test-email`
- ✅ `/api/test/bookings`
- ✅ `/api/test/invitations`
- ✅ `/api/test/leads`
- ✅ `/api/test/playwright-session`
- ✅ `/api/test/reservations/[id]/confirmation`

**Status**: Each should have guard:

```ts
if (process.env.ENABLE_TEST_ENDPOINTS !== 'true') {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
```

**Action**: Audit all test routes and confirm guards are in place.

---

## 9. SUMMARY TABLE: ALL BROKEN ITEMS

| Issue                                  | Type     | Route                           | Severity    | File                        | Fix Status     |
| -------------------------------------- | -------- | ------------------------------- | ----------- | --------------------------- | -------------- |
| `/dashboard` link in settings error    | CTA      | `/app/(app)/settings/error.tsx` | 🔴 CRITICAL | settings/error.tsx:27       | ❌ Needs Fix   |
| `/app/dashboard` in auth callback test | Redirect | `/api/auth/callback/route.ts`   | 🟠 HIGH     | auth/callback/route.test.ts | ❌ Needs Fix   |
| `app.nabatable.com/walk-in` 404        | Routing  | `/app/walk-in`                  | 🔴 CRITICAL | middleware.ts               | ⚠️ Partial     |
| `/auth/signup` unconfirmed             | CTA      | `/auth/signup`                  | 🟡 MEDIUM   | SignInForm.tsx              | ❓ Unknown     |
| `/auth/forgot-password` unconfirmed    | CTA      | `/auth/forgot-password`         | 🟡 MEDIUM   | SignInForm.tsx              | ❓ Unknown     |
| Duplicate `/app` prefix                | Routing  | `/app/app/*`                    | 🟠 HIGH     | middleware.ts               | ⚠️ Partial     |
| Window.location.reload()               | UX       | Multiple                        | 🟡 MEDIUM   | BookingListClient.tsx       | ❌ Needs Fix   |
| Auth callback fallback                 | Logic    | `/api/auth/callback`            | 🟠 HIGH     | auth/callback/route.ts      | ❓ Unknown     |
| Test endpoints unguarded               | Security | `/api/test/*`                   | 🟠 HIGH     | Multiple                    | ❓ Needs Audit |

---

## 10. QUICK FIX CHECKLIST

### Immediate (Today)

- [ ] Fix `/dashboard` → `/app` in `/src/app/app/(app)/settings/error.tsx:27`
- [ ] Fix `/app/dashboard` → `/app` in auth tests
- [ ] Verify `/auth/signup` and `/auth/forgot-password` routes exist
- [ ] Test `app.nabatable.com/walk-in` (should not 404)

### Short-term (This Week)

- [ ] Replace `window.location.reload()` with `router.refresh()`
- [ ] Add route validation to sanitizeRedirect function
- [ ] Audit all test endpoints for proper guards
- [ ] Test all CTAs on home page
- [ ] Verify 404 page gracefully handles both admin and guest users

### Medium-term (Before Production)

- [ ] Set up automated link checking in CI/CD
- [ ] Document all valid redirect targets
- [ ] Add E2E tests for auth flow redirects
- [ ] Monitor production for 404 errors

---

## 11. FILES TO REVIEW

**Priority Order**:

1. `/src/app/app/(app)/settings/error.tsx` — Has broken `/dashboard` link
2. `/src/app/api/auth/callback/route.ts` — Post-auth redirect logic
3. `/src/app/api/auth/signin/route.ts` — Auth redirect sanitization
4. `/src/app/middleware.ts` — Subdomain routing and 404s
5. `/src/app/auth/signin/page.tsx` — Sign-in form routes
6. `/components/auth/SignInForm.tsx` — Sign-up and forgot password links

---

## Next Steps

1. Run this audit against the actual codebase
2. Fix critical items in this session
3. Add test cases to prevent future breakage
4. Set up monitoring for 404 errors in production
