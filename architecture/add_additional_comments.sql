-- =============================================
-- Add additional_comments column to work_orders
-- =============================================

ALTER TABLE public.work_orders
    ADD COLUMN IF NOT EXISTS additional_comments TEXT;
