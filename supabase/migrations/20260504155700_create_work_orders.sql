-- Drop the existing work_orders table if it exists
DROP TABLE IF EXISTS work_orders;

-- Create the new work_orders table based on the new schema
CREATE TABLE work_orders (
    id VARCHAR(255) PRIMARY KEY,
    work_order_date DATE NOT NULL,
    work_order_number VARCHAR(255) NOT NULL,
    region VARCHAR(50),
    assigned_to VARCHAR(255),
    file_number VARCHAR(255),
    hearing_date DATE,
    division VARCHAR(50),
    request_type VARCHAR(50),
    tat INTEGER,
    due_date DATE,
    audio_length VARCHAR(50),
    word_count INTEGER,
    character_wz_space INTEGER,
    line_count INTEGER,
    status VARCHAR(50),
    del_date DATE,
    employee_comments TEXT,
    regdeck_admin_comments TEXT,
    delivery_status VARCHAR(50),
    days_late INTEGER,
    language VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by UUID
);
