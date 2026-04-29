-- =============================================
-- Migration: Rename wo_date → wo_id (date → text)
-- Run this in Supabase SQL Editor
-- =============================================

-- If the table ALREADY exists, run this:
ALTER TABLE public.work_orders
  ALTER COLUMN wo_date TYPE text USING wo_date::text;

ALTER TABLE public.work_orders
  RENAME COLUMN wo_date TO wo_id;


-- =============================================
-- If the table does NOT exist yet, use the
-- full setup script in work_orders_table.sql
-- (it already includes wo_id as text).
-- =============================================
