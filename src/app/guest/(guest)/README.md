# Guest Public Routes

- **Audience:** prospects and signed-in guests exploring marketing, browse, booking, blog, and legal pages.
- **Auth:** none required. Middleware only sanitizes redirects and API access.
- **Chrome:** marketing vs guest experiences now have dedicated route-group layouts (see below).
- **Errors:** scoped `error.tsx`/`not-found.tsx` keep failures isolated from ops UI.

## Layout / Entry Points

| Route Group          | Paths                                                                                                   | Chrome                                                                                                             | Notes                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `(marketing)`        | `/`, `/product`, `/pricing`, `/contact`                                                                 | `OwnerMarketingNavbar` (Product/Pricing/Contact/Sign in) + dark footer (“Built for restaurants, not marketplaces”) | Primary owner-focused SaaS funnel with CTA → `/login` and `mailto:SUPPORT_EMAIL`. |
| `(guest-experience)` | `/browse`, `/reserve/*`, `/signin`, `/create`, `/blog`, `/privacy-policy`, `/terms`, `/thank-you`, etc. | Legacy `CustomerNavbar` + shared `Footer`                                                                          | Keeps guest booking flows unchanged and isolated from owner marketing copy.       |

## Entry-point rules

- `/` is now the owner SaaS landing page. Guest users should deep link into `/reserve/:slug`, `/browse`, or `/signin`.
- `/partners` issues a permanent redirect to `/` so stale links automatically land on the new funnel.
- `/reserve/*` routes are intentionally untouched to protect the guest booking flow; avoid linking them from owner marketing pages.
