-- =============================================
-- Migration: Work Order Status Reference Table
-- Run this in Supabase SQL Editor
-- =============================================


-- =============================================
-- STEP 1: Create the reference table
-- =============================================

create table public.ref_work_order_statuses (
  name text primary key
);

insert into public.ref_work_order_statuses (name) values
  ('Pending'),
  ('In progress'),
  ('Done');


-- =============================================
-- STEP 2: Enable RLS + read policy
-- =============================================

alter table public.ref_work_order_statuses enable row level security;

create policy "Anyone authenticated can read ref_work_order_statuses"
  on public.ref_work_order_statuses for select
  using (auth.role() = 'authenticated');


-- =============================================
-- STEP 3: Wire the existing work_orders table
--   a) Set a default value of 'Pending'
--   b) Add a FK constraint referencing the new table
--
-- NOTE: If there are existing rows where status IS NULL
--       or contains a value not in the new table, update
--       them first:
--
--   update public.work_orders set status = 'Pending' where status is null;
--   update public.work_orders set status = 'Pending'
--     where status not in ('Pending', 'In progress', 'Done');
-- =============================================

-- Backfill any nulls before adding the constraint
update public.work_orders
  set status = 'Pending'
  where status is null;

-- Set column default
alter table public.work_orders
  alter column status set default 'Pending';

-- Add FK constraint
alter table public.work_orders
  add constraint work_orders_status_fkey
  foreign key (status)
  references public.ref_work_order_statuses(name);


-- =============================================
-- Done!
-- =============================================
