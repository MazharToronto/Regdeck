-- =============================================
-- Add user_id column to ref_users table
-- Links each user name to their auth.users UUID
-- =============================================

-- 1. Add the user_id column (nullable to allow names without auth accounts)
ALTER TABLE public.ref_users
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Backfill user_id from auth.users by matching full_name
UPDATE public.ref_users
SET user_id = u.id
FROM auth.users u
WHERE public.ref_users.name = u.raw_user_meta_data->>'full_name'
  AND public.ref_users.user_id IS NULL;

-- 3. Create a unique index on user_id (allows NULLs but prevents duplicate UUIDs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ref_users_user_id
    ON public.ref_users (user_id)
    WHERE user_id IS NOT NULL;
