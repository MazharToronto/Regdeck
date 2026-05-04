-- =============================================
-- Create ref_users table for FK constraint on work_orders.assigned_to
-- This table stores the user display names used for assignment.
-- =============================================

-- 1. Create the reference table
CREATE TABLE IF NOT EXISTS public.ref_users (
    name TEXT PRIMARY KEY
);

-- 2. Populate from existing auth users' full_name metadata
INSERT INTO public.ref_users (name)
SELECT DISTINCT raw_user_meta_data->>'full_name'
FROM auth.users
WHERE raw_user_meta_data->>'full_name' IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- 3. Also backfill any names already used in work_orders that may not be in auth
INSERT INTO public.ref_users (name)
SELECT DISTINCT assigned_to
FROM public.work_orders
WHERE assigned_to IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- 4. Enable RLS
ALTER TABLE public.ref_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read ref_users"
    ON public.ref_users FOR SELECT
    TO authenticated
    USING (true);

-- 5. Add FK constraint to work_orders
ALTER TABLE public.work_orders
    ADD CONSTRAINT fk_work_orders_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES public.ref_users(name);
