# Lore

The first observed commit is `2026-05-02 939c208a Google Business Profile IA audit & cleanup`. Recent history shows fast iteration around bookings, guest flows, ops dashboards, delivery systems, shadcn primitive enforcement, restaurant profile work, and Google Business Profile cleanup.

## Eras

### Sep 2025: Initial platform shape

The repo started with a Next/Supabase platform shape that still exists in `src/**`, `server/**`, `tests/**`, and `supabase/**`.

### Jan-Feb 2026: Booking and capacity hardening

Soft-hold and capacity migrations such as `supabase/migrations/20260117_add_soft_holds.sql` and `supabase/migrations/20260208013100_create_acquire_soft_holds_atomic.sql` paired with `server/capacity/**` to harden assignment behavior.

### Mar-Apr 2026: Delivery and integration expansion

Email, SMS, Google Business Profile, and dual-sync systems grew through `server/emails/**`, `server/sms/**`, `server/google-business-profile/**`, and `server/dual-sync/**`.

### May 2026: UI and IA cleanup

Recent commits include:

- 2026-05-02 939c208a Google Business Profile IA audit & cleanup
- 2026-05-02 4fef367d Refactor restaurant profile UI and model
- 2026-05-01 2540b3d1 Record shadcn primitive CI evidence
- 2026-05-01 935ef84f Add shadcn primitive task evidence
- 2026-05-01 d5bf64a1 Add shadcn primitives plan and CI gate
- 2026-05-01 84cff20a Remove dev mocks and reservation story files

See [By the numbers](by-the-numbers.md) for current stats.
