-- Add per-restaurant email preference toggles
alter table public.restaurants
  add column if not exists email_send_reminder_24h boolean not null default true,
  add column if not exists email_send_reminder_short boolean not null default true,
  add column if not exists email_send_review_request boolean not null default true;
