# Magic Link Authentication Fix

## Root Cause Analysis

The magic link authentication was failing because the **`NEXT_PUBLIC_ROOT_DOMAIN` environment variable was missing** from both local and production environments.

### Impact of Missing Variable

When `NEXT_PUBLIC_ROOT_DOMAIN` is not set, the application defaults to `"localhost"` throughout the codebase, causing multiple critical issues:

1. **Cookie Domain Misconfiguration**
   - Server: `server/supabase.ts:61-63`
   - Cookies are only set for `.nabatable.com` when `ROOT_DOMAIN !== "localhost"`
   - Without the variable, cookies were not being set with the proper domain
   - Result: Session cookies couldn't be shared across `nabatable.com`, `www.nabatable.com`, and `app.nabatable.com`

2. **Redirect URL Generation**
   - Server: `src/app/api/auth/signin/route.ts:39-59`
   - The callback URL validation logic depends on the root domain
   - Incorrect domain causes redirect URL mismatches with Supabase's allowed list

3. **Session Persistence Failure**
   - Even if the code exchange succeeded, the session cookies weren't properly scoped
   - Users appeared logged out despite successful authentication

## Changes Made

### 1. Added Environment Variable

Added `NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com` to `.env.local`:

```bash
# For production deployment
NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com

# For local development (override in your local .env.local)
# NEXT_PUBLIC_ROOT_DOMAIN=localhost
```

### 2. Enhanced Logging in Callback Handler

File: `src/app/api/auth/callback/route.ts`

Added comprehensive logging to trace the authentication flow:

- Request details (hostname, code presence, redirect parameters)
- Session exchange status and errors
- Session verification
- Final redirect destination

### 3. Improved Error Handling

Modified callback handler to:

- Stop execution if session exchange fails
- Redirect to login page with error message instead of silently failing
- Prevent users from being redirected while logged out

### 4. Enhanced Signin Logging

File: `src/app/api/auth/signin/route.ts`

Added detailed logging for magic link generation:

- Hostname detection
- Root domain value
- Redirect targets
- Final callback URL sent to Supabase

## Deployment Instructions

### For Vercel/Production

1. **Add Environment Variable to Vercel:**

   ```bash
   # In Vercel Dashboard:
   # Project Settings → Environment Variables → Add New

   Name: NEXT_PUBLIC_ROOT_DOMAIN
   Value: nabatable.com
   Environments: Production, Preview, Development
   ```

2. **Redeploy the Application:**

   ```bash
   git add .
   git commit -m "Fix magic link auth by adding NEXT_PUBLIC_ROOT_DOMAIN"
   git push origin main
   ```

3. **Verify Environment Variable is Set:**
   - Check Vercel deployment logs
   - Look for log entries showing `rootDomain: 'nabatable.com'` instead of `'localhost'`

### For Other Hosting Providers

Add the environment variable through your hosting provider's dashboard or configuration files:

**Netlify:**

```
NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com
```

**Railway/Render:**

```
NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com
```

**Docker/Self-Hosted:**
Add to your `.env` file or docker-compose configuration.

## Testing the Fix

### 1. Test Locally (Optional)

For local testing with production Supabase:

```bash
# In .env.local, ensure you have:
NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com

# Restart your dev server
npm run dev
```

Test on `localhost:3000` - cookies will still work because localhost is handled specially.

### 2. Test in Production

1. **Request a magic link:**
   - Go to https://nabatable.com/auth/signin
   - Enter your email
   - Request magic link

2. **Check server logs for:**

   ```
   [Auth/signin] Magic link details: {
     hostname: 'nabatable.com',
     rootDomain: 'nabatable.com',  // Should be 'nabatable.com', NOT 'localhost'
     redirectTarget: '/guest/dashboard',
     absoluteRedirect: 'https://www.nabatable.com/guest/dashboard',
     emailRedirectTo: 'https://nabatable.com/api/auth/callback?redirectedFrom=...'
   }
   ```

3. **Click the magic link in your email**

4. **Check callback logs for:**

   ```
   [auth/callback] Request received: {
     hostname: 'nabatable.com',
     rootDomain: 'nabatable.com',  // Should be 'nabatable.com'
     hasCode: true,
     redirectedFrom: 'https://www.nabatable.com/guest/dashboard'
   }

   [auth/callback] Session exchanged successfully: {
     userId: 'xxx',
     email: 'user@example.com'
   }

   [auth/callback] Session verification: {
     hasSession: true,
     sessionUserId: 'xxx'
   }
   ```

5. **Verify successful authentication:**
   - You should be redirected to `/guest/dashboard`
   - You should be logged in
   - Check browser DevTools → Application → Cookies
   - Should see cookies with domain `.nabatable.com`

## Rollback Plan

If issues persist:

1. **Check Supabase Dashboard:**
   - Verify redirect URLs are still configured correctly
   - Ensure `https://nabatable.com/**` is in the allowed list

2. **Revert changes:**

   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Review logs for specific errors:**
   - Session exchange failures
   - Cookie setting issues
   - Redirect loop problems

## Additional Notes

### Why This Wasn't Caught Earlier

- Local development uses `localhost` which has special handling
- The code has fallbacks to `"localhost"` which masked the issue
- Cookies work differently on localhost vs production domains

### Related Files Modified

- `.env.local` - Added `NEXT_PUBLIC_ROOT_DOMAIN`
- `src/app/api/auth/callback/route.ts` - Enhanced logging and error handling
- `src/app/api/auth/signin/route.ts` - Enhanced logging

### Related Configuration Files (No Changes Required)

- `server/supabase.ts` - Cookie domain logic (already correct)
- `lib/auth/redirects.ts` - Redirect validation logic (already correct)
- `config.ts` - Callback URL configuration (already correct)

## Success Criteria

✅ Environment variable is set in production
✅ Logs show `rootDomain: 'nabatable.com'` instead of `'localhost'`
✅ Users can successfully authenticate via magic links
✅ Users are redirected to the dashboard while logged in
✅ Session cookies are properly set with `.nabatable.com` domain
✅ Authentication persists across page refreshes
