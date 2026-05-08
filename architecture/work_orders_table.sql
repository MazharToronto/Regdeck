-- =============================================
-- InvoiceGen: Complete Database Setup
-- Run this ENTIRE script in Supabase SQL Editor
-- =============================================


-- =============================================
-- STEP 1: Reference Data Tables
-- =============================================

-- 1a. Languages
create table public.ref_languages (
  code text primary key,
  label text not null
);

insert into public.ref_languages (code, label) values
  ('EN', 'English'),
  ('FR', 'French');

-- 1b. Regions
create table public.ref_regions (
  name text primary key
);

insert into public.ref_regions (name) values
  ('Central'),
  ('Eastern'),
  ('Rexdale'),
  ('Western');

-- 1c. Divisions
create table public.ref_divisions (
  name text primary key
);

insert into public.ref_divisions (name) values
  ('ID'),
  ('RPD'),
  ('RAD'),
  ('IAD');

-- 1d. Request Types
create table public.ref_request_types (
  name text primary key
);

insert into public.ref_request_types (name) values
  ('Full'),
  ('Bench');

-- 1e. TAT Scores
create table public.ref_tat_scores (
  value integer primary key
);

insert into public.ref_tat_scores (value) values
  (10), (5), (4), (3), (2), (1);


-- =============================================
-- STEP 2: Enable RLS on all reference tables
-- (allow all authenticated users to read)
-- =============================================

alter table public.ref_languages enable row level security;
alter table public.ref_regions enable row level security;
alter table public.ref_divisions enable row level security;
alter table public.ref_request_types enable row level security;
alter table public.ref_tat_scores enable row level security;

create policy "Anyone authenticated can read ref_languages"
  on public.ref_languages for select
  using (auth.role() = 'authenticated');

create policy "Anyone authenticated can read ref_regions"
  on public.ref_regions for select
  using (auth.role() = 'authenticated');

create policy "Anyone authenticated can read ref_divisions"
  on public.ref_divisions for select
  using (auth.role() = 'authenticated');

create policy "Anyone authenticated can read ref_request_types"
  on public.ref_request_types for select
  using (auth.role() = 'authenticated');

create policy "Anyone authenticated can read ref_tat_scores"
  on public.ref_tat_scores for select
  using (auth.role() = 'authenticated');


-- =============================================
-- STEP 3: Work Orders Table
-- =============================================

CREATE TABLE public.work_orders (
  id text primary key,                                        -- Composite PK: WorkOrder_Assignee_Seq
  created_at timestamp with time zone default now() not null,
  language text not null default 'EN',                        -- EN or FR
  wo_date date,                                               -- Work Order Date
  work_order_number text not null,
  region text not null,
  assigned_to text not null,                                  -- Mapped from Supabase Auth Users
  file_number text,
  hearing_date date,
  division text not null,
  request_type text not null,
  tat integer not null default 5,                             -- Turn Around Time (1, 2, 3, 4, 5, 10)
  due_date date,
  audio_length text,                                          -- Format: HH:MM:SS or MM:SS
  word_count text,
  character_wz_space text,
  line_count integer default 0,
  status text,                                                -- Pending, In progress, Done
  delivery_date date,                                         -- Del Date
  employee_comments text,
  regdeck_admin_comments text,
  additional_comments text,
  delivery_status text,
  days_late integer default 0,
  created_by uuid references auth.users not null              -- Foreign key to auth.users
);
-- =============================================
-- RLS Policies on work_orders
-- =============================================
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
-- Allow authenticated users to view all work orders
CREATE POLICY "Authenticated users can view all work orders"
  ON public.work_orders FOR SELECT
  USING (auth.role() = 'authenticated');
-- Allow authenticated users to insert work orders
CREATE POLICY "Authenticated users can insert work orders"
  ON public.work_orders FOR INSERT
  WITH CHECK (auth.uid() = created_by);
-- Allow authenticated users to update work orders
-- (Depending on your exact app rules, you might want managers/admins to update ALL, 
-- but this allows the creator to update at minimum)
CREATE POLICY "Authenticated users can update their own work orders"
  ON public.work_orders FOR UPDATE
  USING (auth.role() = 'authenticated');

-- =============================================
-- STEP 5: Profiles view (for Assigned To dropdown)
-- Creates a view that exposes user names from auth
-- =============================================

create or replace view public.user_profiles as
select
  id,
  raw_user_meta_data->>'full_name' as full_name,
  email
from auth.users;

-- Grant access to authenticated users
grant select on public.user_profiles to authenticated;


-- =============================================
-- Done! All tables and policies are set up.
-- =============================================
