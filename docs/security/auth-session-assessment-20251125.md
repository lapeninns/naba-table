# Authentication, Session, and State Management Assessment (2025-11-25)

## EXECUTIVE SUMMARY

- **Overall posture:** Medium risk – relies on Supabase-managed auth but lacks MFA, strong password policy, and server-side abuse protections.
- **Top issues:** (1) No MFA or step-up verification; (2) Weak password policy (no minimum length/complexity); (3) No server-side rate limiting or bot protection on sign-in/magic-link flows; (4) Session cookies rely on Supabase defaults with no CSRF hardening; (5) Client-side state persistence may store sensitive query data in `localStorage` without encryption.
- **Recommended immediate actions:** Enforce password strength and rate limits, add MFA, harden session/cookie settings (CSRF, secure flags), and scope/purge persisted client data or move to HTTP-only storage for sensitive payloads.

## DETAILED FINDINGS

### 1. Authentication

**Current implementation:**

- Supabase provides both password and magic-link sign-in from the client using the browser Supabase client initialized with the public anon key; sign-in form toggles between modes and posts directly to Supabase auth endpoints.【F:components/auth/SignInForm.tsx†L35-L191】【F:lib/supabase/browser.ts†L13-L25】
- Auth callback exchanges the Supabase code for a session on the server and redirects to the requested path; errors are only logged to console.【F:src/app/api/auth/callback/route.ts†L10-L44】
- Service-role Supabase client uses the service key for backend tasks with `persistSession: false`, and tenant-scoped variants add an `X-Restaurant-Id` header for RLS context.【F:server/supabase.ts†L73-L147】
- Sign-out uses Supabase auth sign-out via the browser client.【F:lib/supabase/signOut.ts†L5-L11】

**Vulnerabilities:**

- **No MFA / step-up (High):** Only password or magic-link flows are offered; no MFA hooks or enforcement are present.【F:components/auth/SignInForm.tsx†L35-L191】
- **Weak password policy (Medium):** Password schema only caps length at 256 and allows empty passwords unless provided, with no minimum length or complexity requirements.【F:components/auth/SignInForm.tsx†L22-L99】
- **No server-side rate limiting or brute-force controls (High):** The only throttle is a 60s client-side cooldown on magic-link requests; there is no server enforcement for password or OTP attempts, making brute-force/abuse possible if requests are scripted.【F:components/auth/SignInForm.tsx†L58-L186】
- **Limited auth error logging/monitoring (Medium):** Errors are logged to console without structured logging or alerting; failed exchanges or sign-in errors are not correlated for detection.【F:src/app/api/auth/callback/route.ts†L28-L44】【F:components/auth/SignInForm.tsx†L135-L235】
- **No explicit HTTPS enforcement or origin checks (Low):** Callback and auth flows rely on runtime environment but do not enforce HTTPS or validate host, exposing risk in misconfigured deployments.【F:src/app/api/auth/callback/route.ts†L10-L44】

**Recommendations:**

- Add MFA (e.g., TOTP or WebAuthn) with backup codes and optional enforcement tiers.
- Enforce password strength (minimum length, complexity, breach checks) at validation time before calling Supabase.
- Introduce server-side rate limiting/IP throttling and account lockout/backoff on password and OTP endpoints; consider CAPTCHA for unauthenticated flows.
- Implement structured logging for auth events (success/failure) with alerting; avoid logging sensitive tokens.
- Enforce HTTPS-only deployments and validate allowed redirect origins.

### 2. Session Management

**Current implementation:**

- Sessions are managed by Supabase cookies via `createServerClient` adapters for server components, route handlers, and middleware; cookie adapter simply forwards `setAll` from Supabase without custom flags.【F:server/supabase.ts†L47-L169】
- Service clients disable session persistence and rely on service keys for backend operations.【F:server/supabase.ts†L73-L147】
- Client sign-out invokes Supabase `auth.signOut` to clear cookies/local session state.【F:lib/supabase/signOut.ts†L5-L11】

**Vulnerabilities/risks:**

- **CSRF exposure (High):** Supabase auth cookies are likely stored as first-party cookies; there is no CSRF token or double-submit protection around sensitive POST/PUT route handlers that rely solely on cookie-based auth, increasing risk of cross-site actions if an attacker can trigger authenticated requests.
- **Session security flags not enforced (Medium):** Cookie options such as `secure`, `sameSite=strict`, and short-lived expirations are not configured in the adapter, relying on Supabase defaults; misconfiguration could allow session leakage on non-HTTPS or lax same-site contexts.【F:server/supabase.ts†L47-L169】
- **No session invalidation controls (Low):** There is no mechanism to revoke all sessions on password change or administrator action beyond single sign-out.

**Recommendations:**

- Add CSRF protection (tokens or same-site strict enforcement plus POST safeguards) for routes that depend on Supabase cookies.
- Explicitly configure cookie security flags (`httpOnly`, `secure`, `sameSite=strict`, short max-age) when creating the Supabase client adapters.
- Provide “logout all devices”/session revocation support and rotate sessions on privilege changes.

### 3. State Management

**Current implementation:**

- Client session hook reads Supabase session and updates on auth state changes for UI gating.【F:hooks/useSupabaseSession.ts†L15-L69】
- Ops session context stores active restaurant selection in `localStorage` and syncs across tabs; permissions/feature flags are derived client-side.【F:src/contexts/ops-session.tsx†L14-L126】
- Query persistence writes the TanStack Query cache to `localStorage`, rewriting sanitized data but still persisting arbitrary query payloads; removal is manual.【F:lib/query/persist.ts†L63-L126】
- Analytics helper persists an anonymous ID in `localStorage`.【F:lib/analytics/emit.ts†L82-L90】

**Issues:**

- **Potential sensitive data at rest in `localStorage` (Medium):** Persisted query cache and session metadata can include PII from API responses, stored unencrypted and accessible to XSS or other scripts.【F:lib/query/persist.ts†L63-L126】
- **Client-side authorization derivation (Low):** Ops permissions are derived from memberships passed to the client; without server-side enforcement on APIs this could be spoofed if APIs trust client role claims (needs verification).【F:src/contexts/ops-session.tsx†L14-L126】

**Recommendations:**

- Restrict which queries are persisted (exclude PII-bearing data) or switch to secure, scoped storage; consider encrypting persisted cache or disabling persistence for auth-protected datasets.
- Ensure server-side authorization on all ops APIs regardless of client-derived permissions; avoid trusting client role hints.
- Clear persisted state on logout and consider scoping it per-user to prevent leakage across accounts.

### 4. Additional Security Concerns

- **Environment/secret handling:** Supabase anon key is exposed client-side (expected), but the service-role key is required on the server; ensure it is injected only in server environments and rotated regularly.【F:lib/env-client.ts†L11-L24】【F:server/supabase.ts†L73-L147】
- **Testing/monitoring gaps:** No automated security tests or rate-limit/misuse monitoring were identified; logging is minimal and console-based.【F:components/auth/SignInForm.tsx†L135-L235】【F:src/app/api/auth/callback/route.ts†L28-L44】

## REMEDIATION ROADMAP

**Phase 1: Critical (Immediate - Week 1)**

1. Implement server-side rate limiting and account lockout for password/magic-link endpoints; add CAPTCHA for anonymous traffic (est. 1-2 days).
2. Enable CSRF protections and enforce secure cookie flags for Supabase sessions (est. 1 day).
3. Introduce password strength validation (min length/complexity/breach checks) before Supabase sign-in/sign-up calls (est. 0.5 day).

**Phase 2: High Priority (Week 2-3)**

1. Add MFA (TOTP/WebAuthn) with recovery codes and optional enforcement by role (est. 3-5 days).
2. Harden logging/monitoring for auth events with structured logs and alerting (est. 2 days).
3. Provide session revocation/all-devices logout and session rotation on privilege changes (est. 2 days).

**Phase 3: Medium Priority (Week 4-6)**

1. Refine state persistence to exclude PII-bearing queries or encrypt cache; clear per-user on logout (est. 2-3 days).
2. Audit ops API endpoints to guarantee server-side authorization independent of client role hints (est. 3 days).

**Phase 4: Enhancements (Ongoing)**

1. Enforce HTTPS across environments, validate redirect origins, and document secure deployment defaults (est. 1 day).
2. Add security-focused tests (rate limit, CSRF, auth flows) to CI and perform periodic dependency audits (est. 2-3 days).

## CODE EXAMPLES

- **Password policy (example):** Extend the Zod schema to require 12+ characters with complexity and breach checks before calling Supabase.
- **Rate limiting (example):** Apply middleware (e.g., `rate-limit` or Edge middleware) on `/api/auth/*` to throttle per-IP/email.
- **CSRF token (example):** Issue a double-submit token stored in a cookie + header and validate in route handlers before processing state-changing requests.

## COMPLIANCE CHECKLIST

- MFA: **Not implemented**
- Password policy: **Weak (no minimum)**
- Rate limiting/brute-force protection: **Absent**
- Session cookie security flags: **Not explicitly set**
- CSRF protection: **Absent**
- Audit logging/monitoring: **Minimal (console only)**
- Data persistence encryption: **LocalStorage without encryption for cached data**
