-- ================================================================
-- COMPREHENSIVE FIX: Replace all user_roles subquery-based RLS policies
-- with JWT claims checks to permanently eliminate infinite recursion.
--
-- The custom_access_token_hook injects { "user_roles": ["admin","manager"] }
-- into every JWT. We use: (auth.jwt() -> 'user_roles') ? 'role_name'
-- This is instant, never queries the DB, and cannot recurse.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. user_roles table itself
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_all_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_write_policy" ON public.user_roles;
DROP FUNCTION IF EXISTS public.check_is_admin();

-- Allow all authenticated users to read role assignments
CREATE POLICY "user_roles_select"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (true);

-- Only admins can write role assignments (uses JWT — no DB query, no recursion)
CREATE POLICY "user_roles_admin_write"
    ON public.user_roles FOR INSERT
    TO authenticated
    WITH CHECK ((auth.jwt() -> 'user_roles') ? 'admin');

CREATE POLICY "user_roles_admin_update"
    ON public.user_roles FOR UPDATE
    TO authenticated
    USING ((auth.jwt() -> 'user_roles') ? 'admin');

CREATE POLICY "user_roles_admin_delete"
    ON public.user_roles FOR DELETE
    TO authenticated
    USING ((auth.jwt() -> 'user_roles') ? 'admin');


-- ----------------------------------------------------------------
-- 2. reference_rate table
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and managers can manage reference_rate" ON public.reference_rate;

-- Write: admin OR manager (uses JWT)
CREATE POLICY "reference_rate_admin_manager_write"
    ON public.reference_rate FOR ALL
    TO authenticated
    USING (
        (auth.jwt() -> 'user_roles') ? 'admin'
        OR (auth.jwt() -> 'user_roles') ? 'manager'
    )
    WITH CHECK (
        (auth.jwt() -> 'user_roles') ? 'admin'
        OR (auth.jwt() -> 'user_roles') ? 'manager'
    );


-- ----------------------------------------------------------------
-- 3. work_orders — UPDATE policy
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Authenticated users can update their own work orders" ON public.work_orders;

CREATE POLICY "work_orders_update"
    ON public.work_orders FOR UPDATE
    TO authenticated
    USING (
        -- Admin or Manager (JWT check)
        (auth.jwt() -> 'user_roles') ? 'admin'
        OR (auth.jwt() -> 'user_roles') ? 'manager'
        OR
        -- Employee assigned to this work order (safe: queries ref_users, not user_roles)
        EXISTS (
            SELECT 1 FROM public.ref_users ru
            WHERE ru.name = work_orders.assigned_to AND ru.user_id = auth.uid()
        )
        OR
        -- Original creator fallback
        auth.uid() = created_by
    );


-- ----------------------------------------------------------------
-- 4. work_orders — DELETE policy
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and managers can delete work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Authenticated users can delete their own work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Users can delete work orders" ON public.work_orders;

CREATE POLICY "work_orders_delete"
    ON public.work_orders FOR DELETE
    TO authenticated
    USING (
        (auth.jwt() -> 'user_roles') ? 'admin'
        OR (auth.jwt() -> 'user_roles') ? 'manager'
    );


-- ----------------------------------------------------------------
-- 5. ref_users — UPDATE / INSERT policies (added earlier for is_active)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can update ref_users" ON public.ref_users;
DROP POLICY IF EXISTS "Admins can insert ref_users" ON public.ref_users;

CREATE POLICY "ref_users_admin_update"
    ON public.ref_users FOR UPDATE
    TO authenticated
    USING ((auth.jwt() -> 'user_roles') ? 'admin')
    WITH CHECK ((auth.jwt() -> 'user_roles') ? 'admin');

CREATE POLICY "ref_users_admin_insert"
    ON public.ref_users FOR INSERT
    TO authenticated
    WITH CHECK ((auth.jwt() -> 'user_roles') ? 'admin');
