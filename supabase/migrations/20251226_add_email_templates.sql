-- Add email_templates column to restaurants table
alter table "public"."restaurants"
add column "email_templates" jsonb default null;

comment on column "public"."restaurants"."email_templates" is 'Custom email templates overriding system defaults. Keyed by email type (e.g., "created", "reminder").';
