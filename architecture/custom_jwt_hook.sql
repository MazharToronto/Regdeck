-- 1. Create the custom access token hook function
-- This hook runs every time a JWT is generated or refreshed for a user.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    claims jsonb;
    user_roles_array jsonb;
BEGIN
    -- Extract the original claims from the event
    claims := event->'claims';

    -- Query the database to find all roles associated with the user
    -- We aggregate the role_names into a JSON array (e.g., ["admin", "manager"])
    SELECT COALESCE(jsonb_agg(r.role_name), '[]'::jsonb)
    INTO user_roles_array
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = (event->>'user_id')::uuid;

    -- Inject the custom "user_roles" claim into the JWT
    claims := jsonb_set(claims, '{user_roles}', user_roles_array);

    -- Return the updated claims back to Supabase Auth
    RETURN jsonb_build_object('claims', claims);
END;
$$;

-- 2. Grant Permissions
-- Supabase Auth runs under the `supabase_auth_admin` role. We need to explicitly 
-- grant it permissions to execute the hook and read the role tables.

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

GRANT SELECT ON TABLE public.roles TO supabase_auth_admin;
GRANT SELECT ON TABLE public.user_roles TO supabase_auth_admin;
