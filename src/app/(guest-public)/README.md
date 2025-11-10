# Guest Public Routes

- **Audience:** prospects and signed-in guests exploring marketing, browse, booking, blog, and legal pages.
- **Auth:** none required. Middleware only sanitizes redirects and API access.
- **Chrome:** renders `CustomerNavbar` + marketing footer via `layout.tsx`.
- **Errors:** scoped `error.tsx`/`not-found.tsx` keep failures isolated from ops UI.
