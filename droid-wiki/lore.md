# Lore

This wiki is a snapshot, not a complete repository history. The current checked-out history is on branch `main` at `dd83ed933caee0978331239201255e273c285dc2`.

## Eras

### Sep 2025: Initial platform shape

The repo started with a Next/Supabase platform shape that still exists in `src/**`, `server/**`, `tests/**`, and `supabase/**`.

### Jan-Feb 2026: Booking and capacity hardening

Soft-hold and capacity migrations such as `supabase/migrations/20260117_add_soft_holds.sql` and `supabase/migrations/20260208013100_create_acquire_soft_holds_atomic.sql` paired with `server/capacity/**` to harden assignment behavior.

### Mar-Apr 2026: Delivery and integration expansion

Email, SMS, Google Business Profile, dual-sync systems, and Cloudflare workers grew through `server/emails/**`, `server/sms/**`, `server/google-business-profile/**`, `server/dual-sync/**`, and `cloudflare/**`.

### May 2026: Booking, settings, security, and dual-sync expansion

- 2026-05-27 `dd83ed93` Unify restaurant settings date pickers and cron actor fallback
- 2026-05-27 `e8f5c704` Harden booking security flows and RPC privileges
- 2026-05-25 `2f4fbc1b` Merge pull request #57 from lapeninns/Restaurant-Settings-Improvements
- 2026-05-25 `b75a5400` Apply semantic color tokens and add dev pages
- 2026-05-24 `065cc47d` Add bookings, dual-sync, GBP and UI features
- 2026-05-19 `3542e791` Deduplicate restaurant settings reference data

See [By the numbers](by-the-numbers.md) for current stats.
