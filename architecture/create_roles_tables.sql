-- 1. Create the `roles` table
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert the default roles (admin, manager, employee)
INSERT INTO public.roles (role_name, description) 
VALUES
    ('admin', 'Administrator with full system access'),
    ('manager', 'Manager who can oversee operations'),
    ('employee', 'Standard employee access')
ON CONFLICT (role_name) DO NOTHING;

-- 2. Create the `user_roles` table
-- This establishes a many-to-many relationship, although typically a user has one role.
-- We use a composite primary key (user_id, role_id) to prevent duplicate role assignments.
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    PRIMARY KEY (user_id, role_id)
);

-- 3. Set up Row Level Security (RLS) (Optional but recommended)
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to view the list of roles
CREATE POLICY "Roles are viewable by all authenticated users" 
    ON public.roles FOR SELECT 
    TO authenticated 
    USING (true);

-- Allow users to see their own role assignments
CREATE POLICY "Users can view their own roles" 
    ON public.user_roles FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);

-- (To allow admins to read/write all user roles, you would add an admin policy here later)
