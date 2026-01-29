# Continuity Ledger

Last updated: 2026-01-29T22:07:20Z

## Goal (incl. success criteria)

- Fix Next.js build failure caused by missing `/privacy` route
- Success: `pnpm run build` completes without missing module errors
- Success: `/privacy` renders accessible privacy policy content

## Constraints/Assumptions

- Follow AGENTS.md SDLC phases; task folders required
- UI changes require Chrome DevTools MCP QA artifacts
- Do not print or commit secrets

## Key decisions

- Implement `/privacy` page under marketing layout using guest typography utilities
- Redirect `/privacy-policy` to `/privacy` for canonical path

## State

- Privacy page implemented; build passes with env updates

## Done

- Added `src/app/(public)/(marketing)/privacy/page.tsx`
- Updated `next.config.js` redirect for `/privacy-policy`
- Added `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL` to `.env.local`
- Ran `pnpm run build` (success; next-sitemap warning noted)
- Chrome DevTools MCP QA complete with screenshots

## Now

- Await approved privacy policy content and effective date

## Next

- Replace template policy copy when approved

## Open questions (UNCONFIRMED if needed)

- Provide approved privacy policy text and effective date

## Working set (files/ids/commands)

- `src/app/(public)/(marketing)/privacy/page.tsx`
- `next.config.js`
- `.env.local`
- `tasks/add-privacy-page-20260129-2157/*`
