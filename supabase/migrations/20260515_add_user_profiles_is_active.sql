-- ================================================================
-- DDL: Add is_active column to ref_users table
-- Existing DB design:
--   public.ref_users (name TEXT PK, user_id UUID -> auth.users)
--   public.user_profiles is a VIEW on auth.users (id, full_name, email)
--     ⚠️  DEPRECATED — view dropped in 20260614_drop_user_profiles_view.sql
--   public.user_roles (user_id UUID, role_id UUID -> public.roles)
--   public.roles (id UUID PK, role_name TEXT)
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Add is_active column to the existing ref_users table
--    Default TRUE so existing users are not accidentally disabled
-- ----------------------------------------------------------------
ALTER TABLE public.ref_users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- ----------------------------------------------------------------
-- 2. RLS Policies for the is_active field on ref_users
--    (ref_users already has RLS enabled from create_ref_users.sql)
-- ----------------------------------------------------------------

-- Policy: Any authenticated user can READ ref_users
--   (already exists as "Anyone authenticated can read ref_users" - kept for reference)
-- If it does not exist yet, uncomment below:
-- CREATE POLICY "Anyone authenticated can read ref_users"
--     ON public.ref_users FOR SELECT
--     TO authenticated
--     USING (true);

-- Policy: Only admins can UPDATE ref_users (e.g. toggle is_active)
CREATE POLICY "Admins can update ref_users"
    ON public.ref_users FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid()
              AND r.role_name = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid()
              AND r.role_name = 'admin'
        )
    );

-- Policy: Only admins can INSERT into ref_users
CREATE POLICY "Admins can insert ref_users"
    ON public.ref_users FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid()
              AND r.role_name = 'admin'
        )
    );

-- ----------------------------------------------------------------
-- 3. Update the user_profiles VIEW to also expose is_active
--    so the frontend can read it in one place
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT
    u.id,
    u.raw_user_meta_data->>'full_name' AS full_name,
    u.email,
    ru.is_active
FROM auth.users u
LEFT JOIN public.ref_users ru ON ru.user_id = u.id;

-- Re-grant SELECT to authenticated users (view already had this)
GRANT SELECT ON public.user_profiles TO authenticated;
