-- =============================================
-- Update RLS Policies for work_orders
-- Allow employees to update work orders assigned to them,
-- and allow admins/managers to update any work order.
-- =============================================

-- 1. Drop the existing restrictive update policy
DROP POLICY IF EXISTS "Authenticated users can update their own work orders" ON public.work_orders;

-- 2. Create the new, expanded UPDATE policy
CREATE POLICY "Users can update work orders"
  ON public.work_orders FOR UPDATE
  USING (
    -- Condition A: The user is an Admin or Manager
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.role_name IN ('admin', 'manager')
    )
    OR
    -- Condition B: The user is the Employee assigned to this work order
    EXISTS (
        SELECT 1 FROM public.ref_users ru
        WHERE ru.name = work_orders.assigned_to AND ru.user_id = auth.uid()
    )
    OR
    -- Condition C: The user is the original creator (fallback)
    auth.uid() = created_by
  );
