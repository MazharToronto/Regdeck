-- =============================================
-- PL/pgSQL helper function and procedure to 
-- update: line_count, days_late, late_deduction_amount, and total_amount.
-- Targets rows where line_count is 0 or NULL.
-- =============================================

-- 1. Helper function to calculate business days between two dates,
-- excluding weekends and custom holidays from the public.holidays table.
CREATE OR REPLACE FUNCTION public.calculate_business_days(start_date DATE, end_date DATE)
RETURNS INTEGER AS $$
DECLARE
    business_days INTEGER := 0;
BEGIN
    -- If either date is null, return 0
    IF start_date IS NULL OR end_date IS NULL THEN
        RETURN 0;
    END IF;

    -- If end_date <= start_date, return 0
    IF end_date <= start_date THEN
        RETURN 0;
    END IF;

    -- Count business days (excluding weekends and holidays)
    SELECT count(*)::integer
    INTO business_days
    FROM generate_series(start_date + 1, end_date, '1 day'::interval) AS d(day_date)
    WHERE extract(isodow FROM d.day_date) < 6
      AND NOT EXISTS (
        SELECT 1 FROM public.holidays h 
        WHERE h.holiday_date = d.day_date::date
      );

    RETURN business_days;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.calculate_business_days(DATE, DATE) 
IS 'Calculates the number of business days between start_date (exclusive) and end_date (inclusive), excluding weekends and holidays.';


-- 2. Procedure to calculate and bulk update:
-- - line_count = round(character_wz_space / 65)
-- - days_late = business days between due_date and delivery_date
-- - late_deduction_amount = (word_count * rate_per_word * 0.05 * days_late) (2 decimals)
-- - total_amount = (word_count * rate_per_word) - late_deduction_amount (2 decimals)
-- Only targets rows where line_count is 0 or NULL.
CREATE OR REPLACE PROCEDURE public.update_zero_line_count_work_orders()
AS $$
DECLARE
    r RECORD;
    v_char_count INTEGER;
    v_word_count INTEGER;
    v_rate_per_word DECIMAL(10, 4);
    v_line_count INTEGER;
    v_days_late INTEGER;
    v_late_deduction_amount DECIMAL(10, 2);
    v_total_amount DECIMAL(10, 2);
BEGIN
    FOR r IN 
        SELECT id, language, tat, word_count, character_wz_space, due_date, delivery_date
        FROM public.work_orders
        WHERE line_count = 0 OR line_count IS NULL
    LOOP
        -- Clean character_wz_space (remove non-digits) and cast to integer
        v_char_count := COALESCE(NULLIF(regexp_replace(r.character_wz_space, '[^0-9]', '', 'g'), '')::integer, 0);

        -- Clean word_count (remove non-digits) and cast to integer
        v_word_count := COALESCE(NULLIF(regexp_replace(r.word_count, '[^0-9]', '', 'g'), '')::integer, 0);

        -- 1. Calculate line_count (rounded to nearest integer)
        v_line_count := round(v_char_count::numeric / 65.0)::integer;

        -- 2. Calculate days_late using business days logic
        v_days_late := public.calculate_business_days(r.due_date, r.delivery_date);

        -- 3. Fetch rate per word
        SELECT rate_per_word 
        INTO v_rate_per_word
        FROM public.reference_rate
        WHERE language = r.language AND tat = r.tat;

        -- Fallback rate if not found
        IF v_rate_per_word IS NULL THEN
            v_rate_per_word := 0.0000;
        END IF;

        -- 4. Calculate late_deduction_amount
        IF v_days_late > 0 AND v_word_count > 0 THEN
            v_late_deduction_amount := round((v_word_count * v_rate_per_word * 0.05 * v_days_late)::numeric, 2);
        ELSE
            v_late_deduction_amount := 0.00;
        END IF;

        -- 5. Calculate total_amount
        v_total_amount := round((v_word_count * v_rate_per_word)::numeric, 2) - v_late_deduction_amount;

        -- 6. Update the work order record
        UPDATE public.work_orders
        SET 
            line_count = v_line_count,
            days_late = v_days_late,
            late_deduction_amount = v_late_deduction_amount,
            total_amount = v_total_amount
        WHERE id = r.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON PROCEDURE public.update_zero_line_count_work_orders() 
IS 'Procedure that recalculates and updates line_count, days_late, late_deduction_amount, and total_amount for all work orders where line_count is 0 or NULL.';
