-- Add name fields to users table for display name support
-- first_name and last_name are required; middle_name is optional

alter table public.users
  add column first_name text not null default '',
  add column middle_name text,
  add column last_name text not null default '';

-- Remove defaults after adding (they were only needed for existing rows)
alter table public.users
  alter column first_name drop default,
  alter column last_name drop default;
