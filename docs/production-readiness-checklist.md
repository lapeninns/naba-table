# Production Readiness Checklist

## ✅ Critical Issues - FIXED

### 1. Environment Variable: `NEXT_PUBLIC_ROOT_DOMAIN` ✅

**Status**: ✅ FIXED

**What was done**:

- Added `NEXT_PUBLIC_ROOT_DOMAIN=localhost` to `.env.example`
- Updated routing logic to use this variable

**Action Required**:

- Add to Vercel production environment variables:
  ```
  NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com
  ```

---

### 2. Cookie Domain Configuration for Subdomain Sharing ✅

**Status**: ✅ FIXED

**What was done**:

- Updated `server/supabase.ts` to set cookie domain for cross-subdomain sharing
- Added `ROOT_DOMAIN` constant from environment variable
- Modified `applyCookieDefaults()` to set `domain: .nabatable.com` in production

**Files Updated**:

- `server/supabase.ts` (lines 34, 50-66)

**How it works**:

- In development (`localhost`): No domain set (default behavior)
- In production (`nabatable.com`): Domain set to `.nabatable.com` for subdomain sharing

---

### 3. CSRF Cookie Domain Configuration ✅

**Status**: ✅ FIXED

**What was done**:

- Updated `src/middleware.ts` to set cookie domain for CSRF tokens
- Modified cookie configuration to include domain for cross-subdomain sharing

**Files Updated**:

- `src/middleware.ts` (lines 143-167)

**How it works**:

- CSRF cookies are now shared across `nabatable.com` and `app.nabatable.com`
- Leading dot (`.nabatable.com`) enables sharing across all subdomains

---

## 🔍 Testing Required

### Local Testing with Subdomain

You cannot fully test subdomain behavior on `localhost` without additional setup:

**Option 1: Edit `/etc/hosts`** (Mac/Linux)

```bash
sudo nano /etc/hosts

# Add these lines:
127.0.0.1 nabatable.local
127.0.0.1 app.nabatable.local
```

Then update `.env.local`:

```bash
NEXT_PUBLIC_ROOT_DOMAIN=nabatable.local
```

Access your app at:

- `http://nabatable.local:3000` (guest-facing)
- `http://app.nabatable.local:3000` (restaurant-facing)

**Option 2: Use ngrok/localtunnel for Production-like Testing**

```bash
# Install ngrok
npm install -g ngrok

# Start your Next.js app
npm run dev

# In another terminal, tunnel it
ngrok http 3000

# You'll get URLs like:
# https://abc123.ngrok.io (set as NEXT_PUBLIC_ROOT_DOMAIN)
# Configure subdomain routing in ngrok dashboard
```

### Test Cases

After deploying or setting up local subdomain testing:

1. **Guest → Restaurant Redirect**
   - Visit `nabatable.com/app/walk-in`
   - Verify redirect to `app.nabatable.com/walk-in`
   - Verify URL shows correct domain

2. **Restaurant Routes**
   - Visit `app.nabatable.com/walk-in`
   - Verify page loads (doesn't 404)
   - Verify internal rewrite to `/app/walk-in`

3. **Duplicate Path Handling**
   - Visit `app.nabatable.com/app/walk-in`
   - Verify redirect to `app.nabatable.com/walk-in`

4. **Authentication Cross-Subdomain**
   - Log in on `nabatable.com`
   - Visit `app.nabatable.com/*`
   - Verify you're still logged in
   - Check cookies in DevTools → Application → Cookies

5. **API Rewrites**
   - On `app.nabatable.com`, call `/api/bookings`
   - Verify request goes to `/api/ops/bookings`
   - Check Network tab in DevTools

6. **CSRF Protection**
   - Check that CSRF cookie exists
   - Verify domain is set to `.nabatable.com`
   - Test POST requests work on both domains

---

## 📋 Deployment Steps

### Pre-Deployment

- [x] ✅ Add `NEXT_PUBLIC_ROOT_DOMAIN` to `.env.example`
- [x] ✅ Update cookie domain configuration in `server/supabase.ts`
- [x] ✅ Update CSRF cookie domain in `src/middleware.ts`
- [ ] **REQUIRED**: Add `NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com` to Vercel production env vars
- [ ] Test locally with subdomain setup (optional but recommended)
- [ ] Deploy to Vercel
- [ ] Review all test cases pass (after deployment)

### DNS Configuration

Ensure DNS records are set up:

```
A     nabatable.com          → Your server IP / Load balancer
CNAME app.nabatable.com      → nabatable.com (or your hosting platform)
CNAME www.nabatable.com      → nabatable.com
```

### Vercel-Specific Setup

If using Vercel:

1. **Add Custom Domain**:
   - Add `nabatable.com` as custom domain
   - Add `app.nabatable.com` as custom domain
   - Add `www.nabatable.com` as custom domain

2. **Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add: `NEXT_PUBLIC_ROOT_DOMAIN` = `nabatable.com`
   - Deploy to apply changes

3. **SSL Certificates**:
   - Vercel auto-provisions SSL for all domains
   - Verify all domains show HTTPS

### Post-Deployment Verification

- [ ] Visit `https://nabatable.com/app/walk-in`
- [ ] Confirm redirect to `https://app.nabatable.com/walk-in`
- [ ] Test authentication across subdomains
- [ ] Check cookies have correct domain in browser DevTools
- [ ] Test all restaurant-facing routes load
- [ ] Test API endpoints respond correctly
- [ ] Monitor error logs for 404s or redirect loops

---

## 🚨 Breaking Changes

### For Existing Deployments

If you're already deployed with the old routing (requiring `/app/*` prefix on app subdomain):

**Old Behavior**:

- `app.nabatable.com/app/walk-in` ✅ Worked
- `app.nabatable.com/walk-in` ❌ 404

**New Behavior**:

- `app.nabatable.com/app/walk-in` ➡️ Redirects to `/walk-in`
- `app.nabatable.com/walk-in` ✅ Works

**Impact**:

- Existing bookmarked links with `/app/app/walk-in` will still work (redirect)
- No hardcoded frontend links found that would break
- API endpoints unchanged

**Migration**: Zero downtime - the new routing is backward compatible via redirects.

---

## 🔒 Security Considerations

### Cookie Security

With shared domain cookies (`.nabatable.com`):

✅ **Pros**:

- Seamless authentication across guest and restaurant interfaces
- Better UX (no re-login needed)

⚠️ **Cons**:

- Cookies are shared across all subdomains
- If you add other subdomains (e.g., `admin.nabatable.com`), they'll also have access to auth cookies

**Mitigation**:

- All subdomains should be under your control
- Use `httpOnly` for auth cookies (already implemented)
- Use `secure` flag in production (already implemented)
- Validate user roles/permissions in each API endpoint

### CORS Considerations

If you have API calls between subdomains:

- With shared domain cookies, you may need to configure CORS
- Next.js API routes should handle same-domain requests fine
- External API calls will need explicit CORS headers

---

## ✅ Summary

**Must Fix Before Production**:

1. Add `NEXT_PUBLIC_ROOT_DOMAIN` environment variable
2. Update cookie domain configuration in `server/supabase.ts`
3. Update CSRF cookie domain in `src/middleware.ts`
4. Test with subdomain setup (local or staging)

**Nice to Have**:

- Set up monitoring for 404s on app subdomain
- Add logging for middleware redirects
- Document subdomain architecture for team

**Estimated Time**: 1-2 hours (including testing)

**Risk Level**: Medium

- Breaking: Cookie domain changes require careful testing
- Non-breaking: Routing changes are backward compatible
