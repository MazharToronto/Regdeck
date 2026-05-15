-- =============================================
-- InvoiceGen: Reference Rate Table
-- Safe to re-run — drops and recreates cleanly
-- =============================================


-- =============================================
-- STEP 1: Clean up any previous attempt
-- =============================================

DROP TABLE IF EXISTS public.reference_rate CASCADE;


-- =============================================
-- STEP 2: Create the reference_rate table
-- =============================================

CREATE TABLE public.reference_rate (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  language TEXT NOT NULL
    REFERENCES public.ref_languages(code)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  tat INTEGER NOT NULL
    REFERENCES public.ref_tat_scores(value)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  rate_per_word DECIMAL(10, 4) NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Unique constraint: one rate per language + TAT combination
ALTER TABLE public.reference_rate
  ADD CONSTRAINT uq_reference_rate_language_tat UNIQUE (language, tat);

-- Table comments
COMMENT ON TABLE public.reference_rate IS 'Stores the rate per word for each language and TAT combination, used in invoice generation.';


-- =============================================
-- STEP 3: Enable RLS + Policies
-- =============================================

ALTER TABLE public.reference_rate ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user
CREATE POLICY "Authenticated users can read reference_rate"
  ON public.reference_rate
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Write: admin and manager only
CREATE POLICY "Admins and managers can manage reference_rate"
  ON public.reference_rate
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.role_name IN ('admin', 'manager')
    )
  );


-- =============================================
-- STEP 4: Sample Data
-- =============================================

INSERT INTO public.reference_rate (language, tat, rate_per_word) VALUES
  ('EN', 10, 0.0180),
  ('EN',  5, 0.0280),
  ('EN',  3, 0.0120),
  ('EN',  2, 0.0140),
  ('EN',  1, 0.0120),
  ('FR', 10, 0.0470),
  ('FR',  5, 0.0480),
  ('FR',  3, 0.0400),
  ('FR',  2, 0.0400),
  ('FR',  1, 0.0400);


-- =============================================
-- Done!
-- =============================================
