-- ==============================================================
-- SQL Insert Script for Sample Work Orders
-- Note: This uses an anonymous code block (DO $$) to automatically
-- fetch an existing user's UUID for the required 'created_by' field.
-- You can run this directly in the Supabase SQL Editor.
-- ==============================================================

DO $$
DECLARE
    v_user_id uuid;
BEGIN
    -- 1. Get an existing user id to satisfy the 'created_by' constraint
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No user found in auth.users. Please sign up at least one user first.';
    END IF;

    -- 2. Insert the records
    INSERT INTO public.work_orders (
        id, 
        wo_id, 
        work_order_number, 
        region, 
        assigned_to, 
        file_number, 
        hearing_date, 
        division, 
        request_type, 
        tat, 
        due_date, 
        audio_length, 
        line_count, 
        delivery_date, 
        transcriptionist_comments, 
        regdeck_admin_comments, 
        delivery_status, 
        days_late, 
        created_by
    ) VALUES
    ('RCE-10342-DD_Sylvia_0001', '216', 'RCE-10342-DD', 'Eastern', 'Nandha', 'MC6-03824', NULL, 'RAD', 'Full', 10, '2026-03-02', '00:39', 0, '2026-03-04', 'Hearing date corrected', NULL, 'Late', 2, v_user_id),
    ('RCE-10342-DD_Sylvia_0002', '216', 'RCE-10342-DD', 'Eastern', 'Nandha', 'MC6-03720', NULL, 'RAD', 'Full', 10, '2026-03-02', '02:39', 0, '2026-03-02', NULL, NULL, 'On Time', 0, v_user_id),
    ('RCE-10342-DD_Sylvia_0003', '216', 'RCE-10342-DD', 'Eastern', 'Nandha', 'MC6-03682', NULL, 'RAD', 'Full', 10, '2026-03-02', '03:06', 0, '2026-03-02', NULL, NULL, 'On Time', 0, v_user_id),
    ('RCE-10343-DD-SP_Laurel_0001', '216', 'RCE-10343-DD-SP', 'Eastern', 'Nandha', 'MC6-03775', NULL, 'RAD', 'Full', 10, '2026-03-02', '00:23', 0, '2026-03-02', NULL, NULL, 'On Time', 0, v_user_id),
    ('RCE-10343-DD-SP_Laurel_0002', '216', 'RCE-10343-DD-SP', 'Eastern', 'Nandha', 'MC6-03775', NULL, 'RAD', 'Full', 10, '2026-03-02', '03:01', 0, '2026-03-02', NULL, NULL, 'On Time', 0, v_user_id),
    ('RCE-10343-DD-SP_Eugene_0001', '216', 'RCE-10343-DD-SP', 'Eastern', 'Nandha', 'MC6-03689', NULL, 'RAD', 'Full', 10, '2026-03-02', '06:49', 0, '2026-03-02', NULL, NULL, 'On Time', 0, v_user_id),
    ('RCE-10343-DD-SP_Laurel_0003', '216', 'RCE-10343-DD-SP', 'Eastern', 'Nandha', 'MC6-03681', NULL, 'RAD', 'Full', 10, '2026-03-02', '04:10', 0, '2026-03-02', NULL, NULL, 'On Time', 0, v_user_id),
    ('RCE-10397-AA_Virginie_0001', '223', 'RCE-10397-AA', 'Eastern', 'Nandha', 'MC3-09519', NULL, 'RPD', 'Bench', 5, '2026-03-02', '00:06', 0, '2026-02-25', NULL, NULL, 'On Time', 0, v_user_id),
    ('RCE-10397-AA_Virginie_0002', '223', 'RCE-10397-AA', 'Eastern', 'Nandha', 'MC3-33038', NULL, 'RPD', 'Bench', 5, '2026-03-02', '00:14', 0, '2026-02-25', NULL, 'WC - Corrected', 'On Time', 0, v_user_id)
    ON CONFLICT (id) DO NOTHING;
    
END $$;
