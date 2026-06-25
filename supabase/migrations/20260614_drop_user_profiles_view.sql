-- ================================================================
-- SECURITY FIX: Drop public.user_profiles view
--
-- Issue: The view "user_profiles" in the public schema exposes
--        auth.users data (id, email, full_name) to any
--        authenticated role via PostgREST, potentially
--        compromising user data security.
--
-- Impact: Any authenticated user could query all users' emails,
--         IDs, and metadata through the PostgREST API.
--
-- Fix: Drop the view entirely. The frontend already fetches user
--      data through:
--      1. The 'create-user' edge function (uses service role key)
--      2. The 'ref_users' table (has proper RLS policies)
--
-- If a secure alternative is needed in the future, use a
-- SECURITY DEFINER function with explicit role checks.
-- ================================================================

-- 1. Revoke grants first (safe even if already revoked)
REVOKE ALL ON public.user_profiles FROM authenticated;
REVOKE ALL ON public.user_profiles FROM anon;

-- 2. Drop the view
DROP VIEW IF EXISTS public.user_profiles;

-- ================================================================
-- OPTIONAL: Secure replacement function
-- Only returns the current user's own profile data.
-- Uncomment below if any part of the app needs this in the future.
-- ================================================================

-- CREATE OR REPLACE FUNCTION public.get_my_profile()
-- RETURNS TABLE (
--     id UUID,
--     full_name TEXT,
--     email TEXT,
--     is_active BOOLEAN
-- )
-- LANGUAGE sql
-- STABLE
-- SECURITY DEFINER
-- SET search_path = ''
-- AS $$
--     SELECT
--         u.id,
--         u.raw_user_meta_data->>'full_name' AS full_name,
--         u.email,
--         ru.is_active
--     FROM auth.users u
--     LEFT JOIN public.ref_users ru ON ru.user_id = u.id
--     WHERE u.id = auth.uid();
-- $$;
--
-- REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
