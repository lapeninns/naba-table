---
task: old-school-house-access-followup-production
timestamp_utc: 2026-03-25T17:13:28Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Old School House Access Follow-up

## Requirements

- Functional:
  - Ensure `oldschoolhouse@lapeninns.com` has restaurant access for The Old School House in production.
  - Reconfirm the Google review link is the most stable verified link we can safely use.
- Non-functional:
  - Use the canonical production role set and membership storage.
  - Avoid relying on the outdated local-only grant script.
  - Record whether the user account already existed or had to be created.

## Existing Patterns & Reuse

- `restaurant_memberships` is the canonical access table used by server auth guards in `server/team/access.ts`.
- `lib/owner/auth/roles.ts` defines the canonical role set: `owner`, `manager`, `host`, `server`.
- `src/app/api/team/invitations/[token]/accept/route.ts` shows the canonical profile bootstrap + membership upsert flow for invited users.
- `scripts/ensure-auth-user.ts` and `scripts/staging/bootstrap-owner.ts` demonstrate safe auth-user creation/update patterns.

## External Resources

- [The Old School House Google Maps place page](https://www.google.com/maps/place/The+Old+School+House/@52.0557627,-0.8504611,17z/data=!3m1!4b1!4m6!3m5!1s0x487701c45888b76d:0xaeebe77da7ae4e4e!8m2!3d52.0557627!4d-0.8504611!16s%2Fg%2F11sn_2wv7s?hl=en-GB&entry=ttu) — already verified live and currently stored on the restaurant row.

## Constraints & Risks

- `auth.admin.listUsers()` is currently returning a production-side database error in this environment, so user resolution needs additional fallbacks.
- The legacy `scripts/grant-restaurant-access.ts` uses stale role names (`admin/staff/viewer`) and `.env.local`, so it is not safe for this production task.
- If the auth user does not exist, we need to create it in a way that still allows sign-in later.

## Open Questions (owner, due)

- None. Proceeding with `manager` as the least-surprising admin-capable role for a venue mailbox account.

## Recommended Direction (with rationale)

- Keep the current Google review URL as-is because it already points to the verified canonical Google Maps place page, which is the most stable Google-owned review destination confirmed for this venue.
- Add a new guarded production access script that:
  - resolves the user through profiles, auth admin, or DB lookup,
  - creates the auth user if missing,
  - ensures the public profile row exists,
  - upserts a `manager` membership for The Old School House.
