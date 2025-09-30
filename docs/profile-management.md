# Profile Management

## Overview

Authenticated users can visit `/profile/manage` to review and edit their profile. The page is backed by Supabase (Postgres) data stored in `public.profiles` and secured with row-level policies (`auth.uid() = id`). UI uses React Hook Form, Zod validation, and Supabase Storage for avatar uploads.

## Routes

- **`/profile/manage`** — Protected server component that fetches the current profile via Supabase. Unauthenticated visitors are redirected to `config.auth.loginUrl` with `redirectedFrom=/profile/manage`.
- **`app/api/profile/route.ts`**
  - `GET` returns `{ profile }` (id, email, name, phone, image, createdAt, updatedAt) and auto-seeds a default row if missing.
  - `PUT` accepts JSON body with optional `name`, `phone`, and `image`; `email` changes are rejected. Responses are `{ profile }` or `{ code, message }` on error.
- **`app/api/profile/image/route.ts`** — Accepts multipart/form-data with `file` (JPEG/PNG/WEBP/SVG ≤2 MB). Uploads to Supabase Storage bucket `profile-avatars/<userId>/<timestamp>-<uuid>.<ext>` and responds with `{ path, url, cacheKey }`.

## Validation rules

- Name trimmed to 2–80 characters. Empty string clears the name (`null` in DB).
- Phone accepts digits plus `+ ( ) -` and spaces; requires 7–20 digits after trimming. Empty string clears the phone (`null`).
- Image URLs must be HTTPS. Clearing the field removes the stored avatar.
- Email is read-only and must match the Supabase session.
- Client-side avatar picker mirrors server validation (size + MIME type) and shows inline errors.

## Storage notes

- Server route automatically creates the `profile-avatars` bucket (public) if it doesn’t exist. Verify in Supabase console and adjust storage policies if stricter access is required.
- Uploaded URLs include a cache-busting `?v=<timestamp>` query parameter to avoid stale previews.

## Accessibility & UX

- Buttons retain labels and show animated spinner while requests are pending.
- Focus returns to the first validation error after failed submission; success messages are announced in a `polite` live region.
- Inputs preserve 44 px touch targets and visible `:focus-visible` outlines using shared UI primitives.

## Testing

- **Unit:** `pnpm vitest run tests/profile/schema.test.ts tests/profile/api.test.ts`
- **Component:** `pnpm vitest run tests/profile/ProfileManageForm.test.tsx`
- **E2E:** With the Next.js dev server running (`pnpm dev`), execute `pnpm test:e2e` to run Playwright spec `reserve/tests/e2e/profile.manage.spec.ts`.

## Implementation references

- API + validation: `app/api/profile/route.ts`, `lib/profile/schema.ts`, `lib/profile/server.ts`
- Supabase storage upload: `app/api/profile/image/route.ts`
- UI + hooks: `components/profile/ProfileManageForm.tsx`, `hooks/useProfile.ts`
- Middleware protection: `middleware.ts`
