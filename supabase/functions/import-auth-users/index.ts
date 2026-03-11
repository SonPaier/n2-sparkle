import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  instance_id: string | null;
  is_blocked: boolean;
  phone: string | null;
  username: string | null;
  created_at: string;
  updated_at: string;
};

const ensureJsonString = (val: unknown): string => {
  if (val === null || val === undefined) return "{}";
  if (typeof val === "string") return val;
  return JSON.stringify(val);
};

const restoreProfile = async (sql: any, profile: ProfileRow) => {
  await sql`
    INSERT INTO public.profiles (
      id, email, full_name, instance_id, is_blocked, phone, username, created_at, updated_at
    ) VALUES (
      ${profile.id}::uuid,
      ${profile.email},
      ${profile.full_name},
      ${profile.instance_id ? `${profile.instance_id}` : null}::uuid,
      ${profile.is_blocked},
      ${profile.phone},
      ${profile.username},
      ${profile.created_at},
      ${profile.updated_at}
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      instance_id = EXCLUDED.instance_id,
      is_blocked = EXCLUDED.is_blocked,
      phone = EXCLUDED.phone,
      username = EXCLUDED.username,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at
  `;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { users, dry_run = false, target_db_url } = body;

    if (!users || !Array.isArray(users)) {
      return new Response(JSON.stringify({ error: "Missing 'users' array in body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!target_db_url) {
      return new Response(JSON.stringify({ error: "Missing 'target_db_url'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const log: string[] = [];
    const errors: string[] = [];
    let created = 0;
    let skipped = 0;

    log.push(`Rozpoczynam import ${users.length} użytkowników via SQL...`);
    log.push(`Tryb: ${dry_run ? "DRY RUN" : "LIVE"}`);

    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    const sql = postgres(target_db_url, { max: 1 });

    for (const u of users) {
      let existingProfile: ProfileRow | null = null;
      let profileDeleted = false;

      try {
        const existingUser = await sql`SELECT id FROM auth.users WHERE id = ${u.id}::uuid`;
        if (existingUser.length > 0) {
          log.push(`⏭️ SKIP ${u.email} (${u.id}) - już istnieje`);
          skipped++;
          continue;
        }

        if (dry_run) {
          log.push(`🔍 DRY: ${u.email} (${u.id}) - zostałby utworzony`);
          created++;
          continue;
        }

        const profileRows = await sql<ProfileRow[]>`
          SELECT id, email, full_name, instance_id, is_blocked, phone, username, created_at, updated_at
          FROM public.profiles
          WHERE id = ${u.id}::uuid
        `;

        if (profileRows.length > 0) {
          existingProfile = profileRows[0];
          await sql`DELETE FROM public.profiles WHERE id = ${u.id}::uuid`;
          profileDeleted = true;
          log.push(`ℹ️ ${u.email}: tymczasowo usunięto istniejący profil, aby wstawić auth.users`);
        }

        await sql`
          INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password,
            email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
            recovery_token, recovery_sent_at, email_change_token_new, email_change,
            email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
            is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
            phone_change, phone_change_token, phone_change_sent_at,
            email_change_token_current, email_change_confirm_status,
            banned_until, reauthentication_token, reauthentication_sent_at,
            is_sso_user, deleted_at, is_anonymous
          ) VALUES (
            ${u.id}::uuid,
            ${u.instance_id || "00000000-0000-0000-0000-000000000000"}::uuid,
            ${u.aud || "authenticated"},
            ${u.role || "authenticated"},
            ${u.email},
            ${u.encrypted_password || ""},
            ${u.email_confirmed_at || null},
            ${u.invited_at || null},
            ${u.confirmation_token || ""},
            ${u.confirmation_sent_at || null},
            ${u.recovery_token || ""},
            ${u.recovery_sent_at || null},
            ${u.email_change_token_new || ""},
            ${u.email_change || ""},
            ${u.email_change_sent_at || null},
            ${u.last_sign_in_at || null},
            ${ensureJsonString(u.raw_app_meta_data)}::jsonb,
            ${ensureJsonString(u.raw_user_meta_data)}::jsonb,
            ${u.is_super_admin || false},
            ${u.created_at || new Date().toISOString()},
            ${u.updated_at || new Date().toISOString()},
            ${u.phone || null},
            ${u.phone_confirmed_at || null},
            ${u.phone_change || ""},
            ${u.phone_change_token || ""},
            ${u.phone_change_sent_at || null},
            ${u.email_change_token_current || ""},
            ${u.email_change_confirm_status || 0},
            ${u.banned_until || null},
            ${u.reauthentication_token || ""},
            ${u.reauthentication_sent_at || null},
            ${u.is_sso_user || false},
            ${u.deleted_at || null},
            ${u.is_anonymous || false}
          )
        `;

        try {
          await sql`
            INSERT INTO auth.identities (
              id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
            ) VALUES (
              ${u.id}::uuid,
              ${u.id}::uuid,
              ${JSON.stringify({ sub: u.id, email: u.email, email_verified: true })}::jsonb,
              'email',
              ${u.id},
              ${u.last_sign_in_at || u.created_at || new Date().toISOString()},
              ${u.created_at || new Date().toISOString()},
              ${u.updated_at || new Date().toISOString()}
            )
            ON CONFLICT (provider, id) DO NOTHING
          `;
        } catch {
          // identity may already exist in some setups, ignore
        }

        if (existingProfile) {
          await restoreProfile(sql, existingProfile);
          profileDeleted = false;
          log.push(`ℹ️ ${u.email}: przywrócono oryginalny profil po imporcie auth.users`);
        }

        log.push(`✅ ${u.email} (${u.id}) - utworzony`);
        created++;
      } catch (e: unknown) {
        if (profileDeleted && existingProfile) {
          try {
            await restoreProfile(sql, existingProfile);
            log.push(`↩️ ${u.email}: profil przywrócony po błędzie importu`);
          } catch (restoreErr: unknown) {
            const restoreMsg = restoreErr instanceof Error ? restoreErr.message : String(restoreErr);
            errors.push(`⚠️ ${u.email || u.id}: nie udało się przywrócić profilu: ${restoreMsg}`);
          }
        }

        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`❌ ${u.email || u.id}: ${msg}`);
      }
    }

    await sql.end();

    log.push(`\n📊 Podsumowanie: utworzono=${created}, pominięto=${skipped}, błędów=${errors.length}`);

    return new Response(JSON.stringify({ log, errors, created, skipped, total: users.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
