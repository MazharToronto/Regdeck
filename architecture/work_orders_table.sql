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

create table public.work_orders (
  id text primary key,                                        -- Composite PK: WorkOrder_Assignee_Seq
  created_at timestamp with time zone default now() not null,
  language text not null default 'EN'
    references public.ref_languages(code),
  wo_id text,
  work_order_number text not null,
  region text not null
    references public.ref_regions(name),
  assigned_to text not null,
  file_number text,
  hearing_date date,
  division text not null
    references public.ref_divisions(name),
  request_type text not null
    references public.ref_request_types(name),
  tat integer not null default 5
    references public.ref_tat_scores(value),
  due_date date,
  audio_length text,
  word_count integer default 0,
  character_wz_space integer default 0,
  line_count integer default 0,
  status text,
  delivery_date date,
  transcriptionist_comments text,
  regdeck_admin_comments text,
  delivery_status text,
  days_late integer default 0,
  created_by uuid references auth.users not null
);


-- =============================================
-- STEP 4: RLS Policies on work_orders
-- =============================================

alter table public.work_orders enable row level security;

create policy "Authenticated users can view all work orders"
  on public.work_orders for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert work orders"
  on public.work_orders for insert
  with check (auth.uid() = created_by);

create policy "Authenticated users can update their own work orders"
  on public.work_orders for update
  using (auth.uid() = created_by);


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
