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
    // Auth check
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let isAuthorized = token === serviceRoleKey;
    if (!isAuthorized && authHeader?.startsWith("Bearer ")) {
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (user) {
        const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
        const { data: roles } = await supabaseAdmin
          .from("user_roles").select("role").eq("user_id", user.id);
        isAuthorized = roles?.some((r: any) => r.role === "super_admin" || r.role === "admin") || false;
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return new Response(JSON.stringify({ error: "SUPABASE_DB_URL not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    const sql = postgres(dbUrl, { max: 1 });

    const parts: string[] = [];
    parts.push("-- =============================================");
    parts.push("-- FULL SCHEMA EXPORT");
    parts.push("-- Generated: " + new Date().toISOString());
    parts.push("-- =============================================\n");

    // 1. Enable extensions
    parts.push("-- Extensions");
    const extensions = await sql`
      SELECT extname FROM pg_extension 
      WHERE extname NOT IN ('plpgsql') 
      ORDER BY extname
    `;
    for (const ext of extensions) {
      parts.push(`CREATE EXTENSION IF NOT EXISTS "${ext.extname}" WITH SCHEMA extensions;`);
    }
    parts.push("");

    // 2. Enums
    parts.push("-- Enums");
    const enums = await sql`
      SELECT t.typname, 
        array_agg(e.enumlabel ORDER BY e.enumsortorder) as labels
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = 'public'
      GROUP BY t.typname
    `;
    for (const en of enums) {
      const labels = en.labels.map((l: string) => `'${l}'`).join(', ');
      parts.push(`CREATE TYPE public.${en.typname} AS ENUM (${labels});`);
    }
    parts.push("");

    // 3. Tables
    parts.push("-- Tables");
    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    for (const tbl of tables) {
      const tn = tbl.table_name;
      
      const columns = await sql`
        SELECT column_name, data_type, udt_name, is_nullable, column_default,
          character_maximum_length, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${tn}
        ORDER BY ordinal_position
      `;

      parts.push(`\nCREATE TABLE IF NOT EXISTS public.${tn} (`);
      const colDefs: string[] = [];
      for (const col of columns) {
        let typStr = '';
        if (col.udt_name === 'uuid') typStr = 'UUID';
        else if (col.udt_name === 'text') typStr = 'TEXT';
        else if (col.udt_name === 'bool') typStr = 'BOOLEAN';
        else if (col.udt_name === 'int4') typStr = 'INTEGER';
        else if (col.udt_name === 'int8') typStr = 'BIGINT';
        else if (col.udt_name === 'float8') typStr = 'DOUBLE PRECISION';
        else if (col.udt_name === 'numeric') typStr = 'NUMERIC';
        else if (col.udt_name === 'timestamptz') typStr = 'TIMESTAMP WITH TIME ZONE';
        else if (col.udt_name === 'timestamp') typStr = 'TIMESTAMP';
        else if (col.udt_name === 'jsonb') typStr = 'JSONB';
        else if (col.udt_name === 'json') typStr = 'JSON';
        else if (col.udt_name === '_uuid') typStr = 'UUID[]';
        else if (col.udt_name === '_text') typStr = 'TEXT[]';
        else if (col.udt_name === 'app_role') typStr = 'public.app_role';
        else typStr = col.udt_name.toUpperCase();

        let def = `  ${col.column_name} ${typStr}`;
        if (col.is_nullable === 'NO') def += ' NOT NULL';
        if (col.column_default !== null) {
          let defaultVal = col.column_default;
          // Ensure gen_random_bytes uses extensions schema
          defaultVal = defaultVal.replace(/(?<!extensions\.)gen_random_bytes/g, 'extensions.gen_random_bytes');
          def += ` DEFAULT ${defaultVal}`;
        }
        colDefs.push(def);
      }
      parts.push(colDefs.join(',\n'));
      parts.push(');');

      parts.push(`ALTER TABLE public.${tn} ENABLE ROW LEVEL SECURITY;`);
    }
    parts.push("");

    // 4. Primary keys
    parts.push("-- Primary Keys");
    const pks = await sql`
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name
    `;
    for (const pk of pks) {
      parts.push(`ALTER TABLE public.${pk.table_name} ADD PRIMARY KEY (${pk.column_name});`);
    }
    parts.push("");

    // 5. Unique constraints
    parts.push("-- Unique Constraints");
    const uqs = await sql`
      SELECT tc.table_name, tc.constraint_name,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
      GROUP BY tc.table_name, tc.constraint_name
      ORDER BY tc.table_name
    `;
    for (const uq of uqs) {
      parts.push(`ALTER TABLE public.${uq.table_name} ADD CONSTRAINT ${uq.constraint_name} UNIQUE (${uq.columns});`);
    }
    parts.push("");

    // 6. Foreign keys
    parts.push("-- Foreign Keys");
    const fks = await sql`
      SELECT
        tc.table_name, tc.constraint_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name
    `;
    for (const fk of fks) {
      let onDelete = fk.delete_rule !== 'NO ACTION' ? ` ON DELETE ${fk.delete_rule}` : '';
      parts.push(`ALTER TABLE public.${fk.table_name} ADD CONSTRAINT ${fk.constraint_name} FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_table_schema}.${fk.foreign_table_name}(${fk.foreign_column_name})${onDelete};`);
    }
    parts.push("");

    // 7. Functions
    parts.push("-- Functions");
    const funcs = await sql`
      SELECT proname, pg_get_functiondef(oid) as funcdef
      FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
      AND proname NOT IN ('has_role', 'has_instance_role', 'is_user_blocked', 'has_employee_permission', 'handle_new_user', 'update_updated_at_column')
      ORDER BY proname
    `;
    // First add the core functions
    const coreFuncs = await sql`
      SELECT proname, pg_get_functiondef(oid) as funcdef
      FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('has_role', 'has_instance_role', 'is_user_blocked', 'has_employee_permission', 'handle_new_user', 'update_updated_at_column')
      ORDER BY proname
    `;
    for (const fn of [...coreFuncs, ...funcs]) {
      parts.push(fn.funcdef + ';\n');
    }
    parts.push("");

    // 8. Triggers
    parts.push("-- Triggers");
    const triggers = await sql`
      SELECT trigger_name, event_manipulation, event_object_table, action_statement, action_timing, action_orientation
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name
    `;
    const seenTriggers = new Set<string>();
    for (const tr of triggers) {
      const key = `${tr.trigger_name}_${tr.event_object_table}`;
      if (seenTriggers.has(key)) continue;
      seenTriggers.add(key);
      parts.push(`CREATE TRIGGER ${tr.trigger_name} ${tr.action_timing} ${tr.event_manipulation} ON public.${tr.event_object_table} FOR EACH ${tr.action_orientation} ${tr.action_statement};`);
    }
    // Auth trigger
    parts.push(`CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`);
    parts.push("");

    // 9. RLS Policies
    parts.push("-- RLS Policies");
    const policies = await sql`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `;
    for (const p of policies) {
      const permissive = p.permissive === 'PERMISSIVE' ? '' : ' AS RESTRICTIVE';
      const roles = p.roles ? ` TO ${p.roles.join(', ')}` : '';
      let stmt = `CREATE POLICY "${p.policyname}" ON public.${p.tablename}${permissive} FOR ${p.cmd}${roles}`;
      if (p.qual) stmt += ` USING (${p.qual})`;
      if (p.with_check) stmt += ` WITH CHECK (${p.with_check})`;
      stmt += ';';
      parts.push(stmt);
    }
    parts.push("");

    // 10. Storage buckets
    parts.push("-- Storage Buckets");
    const buckets = await sql`
      SELECT id, name, public FROM storage.buckets ORDER BY name
    `;
    for (const b of buckets) {
      parts.push(`INSERT INTO storage.buckets (id, name, public) VALUES ('${b.id}', '${b.name}', ${b.public}) ON CONFLICT (id) DO NOTHING;`);
    }
    parts.push("");

    // 11. Storage policies
    parts.push("-- Storage Policies");
    const storagePolicies = await sql`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'storage'
      ORDER BY tablename, policyname
    `;
    for (const p of storagePolicies) {
      const permissive = p.permissive === 'PERMISSIVE' ? '' : ' AS RESTRICTIVE';
      const roles = p.roles ? ` TO ${p.roles.join(', ')}` : '';
      let stmt = `CREATE POLICY "${p.policyname}" ON storage.${p.tablename}${permissive} FOR ${p.cmd}${roles}`;
      if (p.qual) stmt += ` USING (${p.qual})`;
      if (p.with_check) stmt += ` WITH CHECK (${p.with_check})`;
      stmt += ';';
      parts.push(stmt);
    }

    // 12. Realtime publications
    parts.push("\n-- Realtime");
    const realtimeTables = await sql`
      SELECT schemaname, tablename 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
    `;
    for (const rt of realtimeTables) {
      parts.push(`ALTER PUBLICATION supabase_realtime ADD TABLE public.${rt.tablename};`);
    }

    await sql.end();

    const fullSchema = parts.join('\n');

    return new Response(JSON.stringify({ 
      schema: fullSchema, 
      tables_count: tables.length,
      policies_count: policies.length,
      functions_count: coreFuncs.length + funcs.length,
    }), {
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
