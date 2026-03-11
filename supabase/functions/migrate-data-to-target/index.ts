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
    // Auth: only super_admin
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
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          serviceRoleKey
        );
        const { data: roles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        isAuthorized = roles?.some((r: any) => r.role === "super_admin" || r.role === "admin") || false;
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const migrateAll = body.all === true;
    const dryRun = body.dry_run || false;
    const targetUrl = body.target_url;
    const targetKey = body.target_service_role_key;

    if (!targetUrl || !targetKey) {
      return new Response(JSON.stringify({ error: "Missing target_url or target_service_role_key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const source = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
    const target = createClient(targetUrl, targetKey);

    const log: string[] = [];
    const errors: string[] = [];

    // Tables where target may have composite PK
    const compositeKeyTables: Record<string, string> = {
      workers_settings: "instance_id",
    };

    // Helper: read all rows (paginated)
    const readAll = async (tableName: string, filter?: { col: string; val: string }, batchSize = 500): Promise<any[]> => {
      let allData: any[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        let q = source.from(tableName).select("*");
        if (filter) q = q.eq(filter.col, filter.val);
        q = q.range(offset, offset + batchSize - 1);
        const { data, error } = await q;
        if (error) { errors.push(`${tableName}: read error - ${error.message}`); return allData; }
        if (!data || data.length === 0) { hasMore = false; } else {
          allData = allData.concat(data);
          offset += batchSize;
          if (data.length < batchSize) hasMore = false;
        }
      }
      return allData;
    };

    // Helper: read by IN
    const readByIds = async (tableName: string, col: string, ids: string[]): Promise<any[]> => {
      if (!ids.length) return [];
      let allData: any[] = [];
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const { data, error } = await source.from(tableName).select("*").in(col, chunk).limit(10000);
        if (error) errors.push(`${tableName}: read error - ${error.message}`);
        else if (data) allData = allData.concat(data);
      }
      return allData;
    };

    // Helper: write to target
    const writeToTarget = async (tableName: string, rows: any[], batchSize = 500): Promise<number> => {
      if (!rows.length) { log.push(`${tableName}: 0 rows (skipped)`); return 0; }
      if (dryRun) { log.push(`${tableName}: ${rows.length} rows (dry run)`); return rows.length; }
      
      const conflictKey = compositeKeyTables[tableName] || "id";
      let inserted = 0;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await target.from(tableName).upsert(batch, { 
          onConflict: conflictKey, 
          ignoreDuplicates: true 
        });
        if (error) errors.push(`${tableName}: insert error (batch ${Math.floor(i/batchSize)}) - ${error.message}`);
        else inserted += batch.length;
      }
      log.push(`${tableName}: ${inserted}/${rows.length} rows migrated`);
      return inserted;
    };

    const migrateByInstance = async (tableName: string, instanceId: string) => {
      const rows = await readAll(tableName, { col: "instance_id", val: instanceId });
      await writeToTarget(tableName, rows);
    };

    const migrateByIds = async (tableName: string, col: string, ids: string[]) => {
      const rows = await readByIds(tableName, col, ids);
      await writeToTarget(tableName, rows);
    };

    // Get instances
    let instances: any[] = [];
    if (migrateAll) {
      instances = await readAll("instances");
      log.push(`=== Migrating ALL ${instances.length} instances ===`);
    }

    // Migrate each instance
    for (const instance of instances) {
      const instanceId = instance.id;
      log.push(`--- Instance: ${instance.slug} (${instanceId}) ---`);

      // 1. Instance itself
      await writeToTarget("instances", [instance]);

      // 2. Profiles & user_roles
      await migrateByInstance("profiles", instanceId);
      await migrateByInstance("user_roles", instanceId);

      // 3. Level-1 tables (direct instance_id dependency)
      const l1Tables = [
        "calendar_columns", "employees", "customers", "customer_categories",
        "reminder_types", "projects", "sms_notification_templates",
        "sms_payment_templates", "instance_features", "workers_settings",
        "invoicing_settings", "employee_calendar_configs",
        "dashboard_user_settings", "employee_permissions",
      ];
      for (const t of l1Tables) await migrateByInstance(t, instanceId);

      // 4. Level-2 tables (depend on L1)
      const l2Tables = [
        "customer_addresses", "customer_category_assignments",
        "breaks", "employee_days_off", "notifications",
        "push_subscriptions",
      ];
      for (const t of l2Tables) await migrateByInstance(t, instanceId);

      // 5. Calendar items
      await migrateByInstance("calendar_items", instanceId);

      // 6. Calendar item services (depends on calendar_items + unified_services)
      await migrateByInstance("unified_services", instanceId);
      await migrateByInstance("calendar_item_services", instanceId);

      // 7. Reminders (depends on customers, reminder_types)
      await migrateByInstance("reminders", instanceId);

      // 8. SMS logs
      const smsLogs = await readAll("sms_logs", { col: "instance_id", val: instanceId });
      await writeToTarget("sms_logs", smsLogs);

      // 9. Customer SMS notifications
      await migrateByInstance("customer_sms_notifications", instanceId);

      // 10. Protocols (depends on calendar_items, customers)
      await migrateByInstance("protocols", instanceId);

      // 11. Invoices
      await migrateByInstance("invoices", instanceId);

      // 12. Time entries (depends on employees)
      await migrateByInstance("time_entries", instanceId);

      // 13. Time entry audit log
      await migrateByInstance("time_entry_audit_log", instanceId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: migrateAll ? "all" : "single",
        instances_count: instances.length,
        dry_run: dryRun,
        log,
        errors,
        summary: { total_log_entries: log.length, errors_count: errors.length },
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err), stack: (err as Error)?.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
