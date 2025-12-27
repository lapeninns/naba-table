# Manual Test Prompt (No Credentials Stored)

Use this prompt to validate the app-host auth flow and first-load behavior **without storing credentials in source**.

## Preconditions

- Close all app sessions or open a fresh browser profile/incognito window.
- Clear cookies for `localhost` and `app.localhost` if needed.

## Steps

1. Open: `http://app.localhost:3000/dashboard`
2. Observe the redirect behavior and landing page.
3. If redirected to sign-in, complete login **manually** using your local credentials.
4. After successful login, confirm:
   - You land on `http://app.localhost:3000/dashboard`.
   - The dashboard loads without needing to visit another app route first.
5. Open: `http://app.localhost:3000/bookings`
6. Navigate back to `http://app.localhost:3000/dashboard` and confirm it still loads.

## Expected Results

- First hit to `/dashboard` should load after login without requiring a prior app route visit.
- Session cookies should be scoped to `app.localhost`.

## Notes for Reporting

- Record any redirects (full URL), status codes, and console errors.
- Note whether the issue occurs only on `app.localhost` or also on `app.<rootDomain>`.
