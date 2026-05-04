-- =============================================
-- Create holidays table and insert 2026 data
-- =============================================

-- 1. Create the holidays table
CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holiday_name TEXT NOT NULL,
    holiday_date DATE NOT NULL UNIQUE
);

-- 2. Insert holiday data for the year 2026
INSERT INTO public.holidays (holiday_name, holiday_date)
VALUES
    ('New Year', '2026-01-01'),
    ('Good Friday', '2026-04-03'),
    ('Easter Monday', '2026-04-06'),
    ('Victoria Day', '2026-05-18'),
    ('Saint-Jean-Baptiste Day', '2026-06-24'),
    ('Canada Day', '2026-07-01'),
    ('Civic Holiday', '2026-08-03'),
    ('Labour Day', '2026-09-07'),
    ('National Day for Truth and Reconciliation', '2026-09-30'),
    ('Thanksgiving Day', '2026-10-12'),
    ('Remembrance Day', '2026-11-11'),
    ('Christmas Day', '2026-12-25'),
    ('Boxing Day', '2026-12-26')
ON CONFLICT (holiday_date) DO NOTHING;

-- 3. Enable RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- 4. Allow any authenticated user to view the holidays
CREATE POLICY "Holidays are viewable by all authenticated users" 
    ON public.holidays FOR SELECT 
    TO authenticated 
    USING (true);
