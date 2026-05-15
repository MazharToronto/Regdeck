-- =============================================
-- Add late_deduction_amount and total_amount
-- columns to the work_orders table
-- =============================================

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS late_deduction_amount DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2) DEFAULT 0;

COMMENT ON COLUMN public.work_orders.late_deduction_amount IS 'Calculated: (Word Count * Rate Per Word * 5%) * Days Late';
COMMENT ON COLUMN public.work_orders.total_amount IS 'Calculated: (Rate Per Word * Word Count) - Late Deduction Amount';

-- =============================================
-- Done!
-- =============================================
