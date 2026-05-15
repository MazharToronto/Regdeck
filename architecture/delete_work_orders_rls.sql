-- =============================================
-- Delete RLS Policy for work_orders
-- Allow ONLY admins and managers to delete work orders.
-- Employees are restricted from deleting data.
-- =============================================

-- 1. Drop any existing restrictive delete policy (if it exists)
DROP POLICY IF EXISTS "Authenticated users can delete their own work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Admins and managers can delete work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Users can delete work orders" ON public.work_orders;

-- 2. Create the new DELETE policy
CREATE POLICY "Admins and managers can delete work orders"
  ON public.work_orders FOR DELETE
  USING (
    -- Condition: The user MUST be an Admin or Manager
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.role_name IN ('admin', 'manager')
    )
  );
