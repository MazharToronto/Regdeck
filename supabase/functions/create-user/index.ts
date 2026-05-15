// Supabase Edge Function: manage-users (repurposed from create-user)
// Handles GET (list users), POST (create user), and PUT (update user)

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Server misconfiguration. Missing keys." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Admin Client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // -------------------------------------------------------------
    // GET: List all users + their roles
    // -------------------------------------------------------------
    if (req.method === "GET") {
      // 1. Fetch users from Auth
      const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
      if (usersError) throw usersError;

      // 2. Fetch roles mapping
      const { data: rolesData, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select(`
          user_id,
          role_id,
          roles ( role_name )
        `);
      if (rolesError) throw rolesError;

      // 3. Fetch is_active from ref_users (linked via user_id)
      const { data: refUsersData } = await supabaseAdmin
        .from('ref_users')
        .select('user_id, is_active');

      // 4. Merge data
      const usersWithRoles = usersData.users.map(u => {
        const userRole = rolesData.find(r => r.user_id === u.id);
        const refUser = refUsersData?.find(ru => ru.user_id === u.id);
        return {
          id: u.id,
          email: u.email,
          phone: u.phone,
          full_name: u.user_metadata?.full_name || '',
          created_at: u.created_at,
          role_id: userRole?.role_id || null,
          role_name: userRole?.roles?.role_name || 'No Role',
          is_active: refUser?.is_active ?? true,
        };
      });

      return new Response(JSON.stringify(usersWithRoles), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------------------------------------------------
    // POST: Create a new user
    // -------------------------------------------------------------
    if (req.method === "POST") {
      const body = await req.json();
      const { email, password, phone, full_name, role_id, is_active } = body;

      if (!email || !password || password.length < 6) {
        return new Response(JSON.stringify({ error: "Invalid email or password" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password,
        phone: phone?.trim() || undefined,
        email_confirm: true,
        phone_confirm: false,
        user_metadata: { full_name: full_name?.trim() || undefined },
      });

      if (createError) throw createError;

      if (role_id) {
        await supabaseAdmin.from('user_roles').insert({ user_id: data.user.id, role_id });
      }

      // Upsert a ref_users row linking the new user's auth id and is_active status.
      // The row is keyed by full_name (the table's PK), so we set user_id + is_active.
      // If a row for this full_name already exists, update user_id and is_active.
      if (full_name?.trim()) {
        await supabaseAdmin
          .from('ref_users')
          .upsert(
            { name: full_name.trim(), user_id: data.user.id, is_active: is_active !== false },
            { onConflict: 'name' }
          );
      }

      return new Response(JSON.stringify({ success: true, user: data.user }), {
        status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------------------------------------------------
    // PUT: Update an existing user
    // -------------------------------------------------------------
    if (req.method === "PUT") {
      const body = await req.json();
      const { id, email, password, phone, full_name, role_id, is_active } = body;

      if (!id) {
        return new Response(JSON.stringify({ error: "User ID is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updatePayload: any = {
        email: email?.trim() || undefined,
        user_metadata: { full_name: full_name?.trim() || undefined },
      };
      
      if (phone !== undefined) {
        updatePayload.phone = phone === null || phone.trim() === '' ? '' : phone.trim();
      }
      
      if (password && password.length >= 6) {
        updatePayload.password = password;
      }

      const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(id, updatePayload);
      if (updateError) throw updateError;

      if (role_id) {
        // Delete existing role mapping for the user to avoid composite primary key conflicts
        await supabaseAdmin.from('user_roles').delete().eq('user_id', id);
        // Insert new role mapping
        await supabaseAdmin.from('user_roles').insert({ user_id: id, role_id });
      }

      // Update is_active in ref_users (matched by user_id)
      if (is_active !== undefined) {
        await supabaseAdmin
          .from('ref_users')
          .update({ is_active: Boolean(is_active) })
          .eq('user_id', id);
      }

      return new Response(JSON.stringify({ success: true, user: data.user }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
