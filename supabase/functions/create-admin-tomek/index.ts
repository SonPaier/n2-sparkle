import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const instanceId = "c6300bdc-5070-4599-8143-06926578a424";
  const username = "Tomek";
  const password = "qwerty123";
  const email = `tomek_${instanceId.slice(0, 8)}@internal.local`;

  try {
    // Check if username already exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("instance_id", instanceId)
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "User Tomek already exists" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !authData.user) {
      return new Response(JSON.stringify({ error: createError?.message || "Failed to create user" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const userId = authData.user.id;

    await supabase.from("profiles").update({
      username,
      full_name: username,
      instance_id: instanceId,
      is_blocked: false,
    }).eq("id", userId);

    await supabase.from("user_roles").insert({
      user_id: userId,
      role: "admin",
      instance_id: instanceId,
    });

    return new Response(JSON.stringify({ success: true, userId, message: "Admin Tomek created for Water Grass" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
