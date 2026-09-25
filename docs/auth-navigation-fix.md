# Auth Navigation Fix - Cross-Subdomain Links

**Date**: 2026-01-04  
**Issue**: Sign-in page cross-links not working for subdomain navigation  
**Status**: ✅ Fixed and Verified

---

## Problem

Users reported that clicking "Sign in as a guest →" on the restaurant sign-in page (`app.localhost:3000/auth/signin`) was not redirecting to the guest sign-in page (`localhost:3000/auth/signin`).

### Root Cause

Both sign-in pages used **relative paths** for cross-linking:

- Restaurant page: `<Link href="/auth/signin">` → Would resolve to `app.localhost:3000/auth/signin` (same subdomain)
- Guest page: `<Link href="/app/auth/signin">` → Would resolve to `localhost:3000/app/auth/signin` (same subdomain)

Since the app uses subdomain-based routing:

- `localhost:3000` → Guest/public routes
- `app.localhost:3000` → Restaurant/operations routes

Relative paths don't work for cross-subdomain navigation.

---

## Solution

Replaced relative `<Link>` components with absolute URLs using native `<a>` tags.

### Changes Made

#### 1. Restaurant Sign-In Page (`src/app/app/auth/signin/page.tsx`)

**Added** imports and URL construction:

```typescript
import { headers } from 'next/headers';

// In component body:
const headersList = await headers();
const hostHeader = headersList.get('host') ?? '';
const hostPort = hostHeader.includes(':') ? hostHeader.split(':').pop() : undefined;
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
const guestSignInUrl =
  rootDomain === 'localhost'
    ? `http://localhost${hostPort ? `:${hostPort}` : ''}/auth/signin`
    : `https://${rootDomain.toLowerCase().replace(/^www\./, '')}/auth/signin`;
```

**Changed** link from:

```tsx
<Link href="/auth/signin">Sign in as a guest →</Link>
```

**To**:

```tsx
<a href={guestSignInUrl}>Sign in as a guest →</a>
```

#### 2. Guest Sign-In Page (`src/app/(public)/auth/signin/page.tsx`)

**Added** URL construction:

```typescript
// Already had headers import and rootDomain
const restaurantSignInUrl =
  rootDomain === 'localhost'
    ? `http://app.localhost${hostPort ? `:${hostPort}` : ''}/auth/signin`
    : `https://app.${rootDomain.toLowerCase().replace(/^www\./, '')}/auth/signin`;
```

**Changed** link from:

```tsx
<Link href="/app/auth/signin">Sign in to operations console →</Link>
```

**To**:

```tsx
<a href={restaurantSignInUrl}>Sign in to operations console →</a>
```

---

## Verification

### Manual QA (Chrome DevTools MCP)

✅ **Test 1: Restaurant → Guest**

- Started at: `http://app.localhost:3000/auth/signin`
- Clicked: "Sign in as a guest →"
- Result: Successfully navigated to `http://localhost:3000/auth/signin`
- Page loaded correctly with guest-specific content

✅ **Test 2: Guest → Restaurant**

- Started at: `http://localhost:3000/auth/signin`
- Clicked: "Sign in to operations console →"
- Result: Successfully navigated to `http://app.localhost:3000/auth/signin`
- Page loaded correctly with restaurant-specific content

✅ **Console Errors**: None
✅ **Network Errors**: None
✅ **TypeScript Compilation**: Passing
✅ **Production Build**: Successful

---

## Technical Details

### Why `<a>` instead of `<Link>`?

Next.js `<Link>` component is designed for **client-side navigation within the same app**. For cross-subdomain navigation:

- `<Link>` resolves paths relative to the current origin
- `<a>` with absolute URLs triggers full page navigation (necessary for subdomain change)

### Environment Support

The fix supports both:

- **Development**: `localhost:3000` and `app.localhost:3000`
- **Production**: `yourdomain.com` and `app.yourdomain.com`

URL construction respects `NEXT_PUBLIC_ROOT_DOMAIN` environment variable.

---

## Files Modified

1. `src/app/app/auth/signin/page.tsx` (lines 1-4, 54-70, 197-208)
2. `src/app/(public)/auth/signin/page.tsx` (lines 87-102, 256-267)

---

## Related Documentation

- [Auth Revamp Summary](./auth-revamp-summary.md)
- [Auth Design System (archived)](./design/archive/auth-design-system.md)
- [Auth Testing Guide](./auth-testing-guide.md)

---

## Success Criteria

- [x] Restaurant → Guest navigation works
- [x] Guest → Restaurant navigation works
- [x] URLs change correctly across subdomains
- [x] No console errors
- [x] TypeScript compilation passes
- [x] Production build succeeds
- [x] Works in development (localhost)
- [x] Supports production domains (via env var)

---

**Verified by**: AI Assistant  
**Date**: 2026-01-04
