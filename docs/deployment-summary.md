# Production Deployment Summary

## ✅ What We've Fixed

All critical production issues have been resolved! Here's what was implemented:

### 1. Routing Architecture ✅

- **Main Domain → App Subdomain**: `nabatable.com/app/*` redirects to `app.nabatable.com/*`
- **Clean URLs**: Restaurant staff see `app.nabatable.com/walk-in` instead of `/app/walk-in`
- **Guest Separation**: Guest routes stay on `nabatable.com`, restaurant routes on `app.nabatable.com`

**Files Modified**:

- `src/middleware.ts` - Routing logic with subdomain rewrites
- `docs/restaurant-facing-routes.md` - Complete routing documentation

### 2. Cross-Subdomain Authentication ✅

- **Cookie Domain Sharing**: Cookies now work across `nabatable.com` and `app.nabatable.com`
- **Session Persistence**: Users stay logged in when redirected between domains
- **CSRF Protection**: CSRF tokens shared across subdomains

**Files Modified**:

- `server/supabase.ts:34` - Added ROOT_DOMAIN constant
- `server/supabase.ts:50-66` - Updated cookie configuration with domain
- `src/middleware.ts:143-167` - Updated CSRF cookie with domain

### 3. Environment Configuration ✅

- **Template Updated**: `.env.example` now includes `NEXT_PUBLIC_ROOT_DOMAIN`
- **Local Development**: Works on `localhost` without extra config
- **Production Ready**: Works on `nabatable.com` when env var is set

**Files Modified**:

- `.env.example:35` - Added `NEXT_PUBLIC_ROOT_DOMAIN=localhost`

---

## 🚀 Next Steps: Deploy to Production

### Step 1: Add Environment Variable to Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name**: `NEXT_PUBLIC_ROOT_DOMAIN`
   - **Value**: `nabatable.com`
   - **Environment**: Production (and Preview if you want)
4. Click **Save**

### Step 2: Verify DNS Configuration

Ensure these DNS records exist:

```
Type    Name                    Value
----    ----                    -----
A       nabatable.com           → Your Vercel IP / CNAME
CNAME   app.nabatable.com       → cname.vercel-dns.com
CNAME   www.nabatable.com       → cname.vercel-dns.com
```

In Vercel, add all three domains:

- `nabatable.com` (primary)
- `app.nabatable.com`
- `www.nabatable.com`

### Step 3: Deploy

Option A - **Automatic** (if connected to Git):

```bash
git add .
git commit -m "Add subdomain routing and cross-domain authentication"
git push
```

Option B - **Manual**:

```bash
vercel --prod
```

### Step 4: Verify Deployment

After deployment, test these scenarios:

1. **Redirect Test**
   - Visit: `https://nabatable.com/app/walk-in`
   - Expected: Redirects to `https://app.nabatable.com/walk-in`

2. **Authentication Test**
   - Log in at `https://nabatable.com`
   - Visit `https://app.nabatable.com/dashboard`
   - Expected: Still logged in (no redirect to login)

3. **Cookie Test**
   - Open DevTools → Application → Cookies
   - Check cookies for `.nabatable.com` domain
   - Expected: Auth and CSRF cookies have domain `.nabatable.com`

4. **Restaurant Routes Test**
   - Visit: `https://app.nabatable.com/walk-in`
   - Expected: Page loads (no 404)

   - Visit: `https://app.nabatable.com/bookings`
   - Expected: Bookings page loads

5. **API Test**
   - On `app.nabatable.com`, open DevTools → Network
   - Make an API call to `/api/bookings`
   - Expected: Request goes through successfully

---

## 📝 Production Environment Variables

Here's the complete environment variable you need to add to Vercel:

```bash
NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com
```

**Your existing production env vars** (from what you shared):

- ✅ `NEXT_PUBLIC_APP_URL=https://nabatable.com`
- ✅ `NEXT_PUBLIC_SITE_URL=https://nabatable.com`
- ✅ All other env vars look correct

---

## 🔍 What Changed in the Codebase

### Routing Changes (src/middleware.ts)

**Before**:

```typescript
// On app subdomain: Only /app/* routes worked
if (!url.pathname.startsWith('/app')) {
  return NextResponse.rewrite(notFound, { status: 404 });
}
```

**After**:

```typescript
// On app subdomain: Any route works, internally rewritten to /app/*
if (url.pathname.startsWith('/app/')) {
  // Remove duplicate /app prefix
  return NextResponse.redirect(cleanPath, 308);
}
// Rewrite all routes to /app/* for Next.js
return NextResponse.rewrite(`/app${url.pathname}`);
```

### Cookie Configuration (server/supabase.ts)

**Before**:

```typescript
function applyCookieDefaults(options: Record<string, unknown> = {}) {
  return {
    ...options,
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax' as const,
    path: '/',
    // No domain property
  };
}
```

**After**:

```typescript
function applyCookieDefaults(options: Record<string, unknown> = {}) {
  const cookieConfig: Record<string, unknown> = {
    ...options,
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax' as const,
    path: '/',
  };

  // Set domain for cross-subdomain cookie sharing
  if (ROOT_DOMAIN !== 'localhost') {
    cookieConfig.domain = `.${ROOT_DOMAIN}`;
  }

  return cookieConfig;
}
```

---

## ⚠️ Important Notes

### Zero Downtime

- All changes are **backward compatible**
- Existing links with `/app/app/walk-in` still work (auto-redirect)
- No breaking changes for end users

### Security

- Cookies are `httpOnly` (auth cookies)
- Cookies are `secure` in production
- CSRF protection enabled
- All subdomains must be under your control

### Development vs Production

- **Development** (`localhost`): Cookies work as before
- **Production** (`nabatable.com`): Cookies shared across subdomains

---

## 🎯 Estimated Time

- **Add env var to Vercel**: 2 minutes
- **Deploy**: 3-5 minutes (automatic build)
- **Testing**: 10-15 minutes
- **Total**: ~20 minutes

---

## 🆘 Troubleshooting

### Issue: Still getting 404 on app.nabatable.com

**Check**:

1. DNS record for `app.nabatable.com` exists
2. Domain added in Vercel project settings
3. Deployment successful (check Vercel logs)

### Issue: Not logged in after redirect

**Check**:

1. `NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com` is set in Vercel
2. Cookies show domain `.nabatable.com` (with leading dot)
3. Clear browser cookies and test again

### Issue: CSRF errors

**Check**:

1. CSRF cookie exists with domain `.nabatable.com`
2. Cookie is readable by JavaScript (`httpOnly: false`)
3. Middleware is running (check Vercel function logs)

---

## ✅ Ready for Production!

All critical fixes are complete. Once you add the environment variable to Vercel and deploy, you're ready to go!

**Next steps**:

1. Add `NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com` to Vercel
2. Deploy (or let automatic deployment run)
3. Test all scenarios listed above
4. Monitor logs for any issues

Good luck with your deployment! 🚀
