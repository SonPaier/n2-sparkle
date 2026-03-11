import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["super_admin", "admin"])
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      // Fallback: return users without encrypted_password
      const allUsers: any[] = [];
      let page = 1;
      while (true) {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw new Error(`Failed to list users: ${error.message}`);
        if (!users || users.length === 0) break;
        allUsers.push(...users);
        if (users.length < 1000) break;
        page++;
      }
      return new Response(JSON.stringify({
        users: allUsers.map(u => ({
          id: u.id, email: u.email, phone: u.phone,
          email_confirmed_at: u.email_confirmed_at,
          created_at: u.created_at, updated_at: u.updated_at,
          last_sign_in_at: u.last_sign_in_at,
          raw_user_meta_data: u.user_metadata,
          raw_app_meta_data: u.app_metadata,
          encrypted_password: null,
          role: u.role, aud: u.aud,
        })),
        count: allUsers.length,
        warning: "encrypted_password not available without SUPABASE_DB_URL"
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    const sql = postgres(dbUrl, { max: 1 });

    const dbUsers = await sql`
      SELECT id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
        is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
        phone_change, phone_change_token, phone_change_sent_at,
        email_change_token_current, email_change_confirm_status,
        banned_until, reauthentication_token, reauthentication_sent_at,
        is_sso_user, deleted_at, is_anonymous
      FROM auth.users ORDER BY created_at
    `;

    await sql.end();

    return new Response(JSON.stringify({ users: dbUsers, count: dbUsers.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
