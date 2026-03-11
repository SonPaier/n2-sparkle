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
    // Auth: admin or super_admin
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

    // Validate that target key is a service_role key, not anon
    try {
      const payload = JSON.parse(atob(targetKey.split(".")[1]));
      if (payload.role === "anon") {
        return new Response(JSON.stringify({ 
          error: "Podano anon key zamiast service_role key. Użyj Service Role Key z ustawień projektu docelowego." 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (_) { /* skip validation if JWT parsing fails */ }

    const source = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
    const target = createClient(targetUrl, targetKey);

    const log: string[] = [];
    const errors: string[] = [];

    // Tables with composite PK (not standard "id")
    const compositeKeyTables: Record<string, string> = {
      workers_settings: "instance_id",
      invoicing_settings: "instance_id",
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

    // Helper: write to target with orphan FK nullification
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
        if (error) {
          // Try row-by-row on batch failure to skip problematic rows
          log.push(`${tableName}: batch ${Math.floor(i/batchSize)} failed, trying row-by-row...`);
          for (const row of batch) {
            const { error: rowError } = await target.from(tableName).upsert(row, {
              onConflict: conflictKey,
              ignoreDuplicates: true
            });
            if (rowError) {
              errors.push(`${tableName}: row ${row.id || 'unknown'} - ${rowError.message}`);
            } else {
              inserted++;
            }
          }
        } else {
          inserted += batch.length;
        }
      }
      log.push(`${tableName}: ${inserted}/${rows.length} rows migrated`);
      return inserted;
    };

    const migrateByInstance = async (tableName: string, instanceId: string) => {
      const rows = await readAll(tableName, { col: "instance_id", val: instanceId });
      await writeToTarget(tableName, rows);
    };

    // Nullify orphan FKs for rows referencing parents that may not exist in target
    const nullifyOrphanFKs = (rows: any[], fkColumns: string[], validIds: Set<string>): any[] => {
      return rows.map(row => {
        const cleaned = { ...row };
        for (const col of fkColumns) {
          if (cleaned[col] && !validIds.has(cleaned[col])) {
            cleaned[col] = null;
          }
        }
        return cleaned;
      });
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

      // 3. Level-1 tables (direct instance_id dependency only)
      const l1Tables = [
        "calendar_columns", "employees", "customers", "customer_categories",
        "reminder_types", "unified_services", "projects",
        "sms_notification_templates", "sms_payment_templates",
        "instance_features", "workers_settings", "invoicing_settings",
        "employee_calendar_configs", "dashboard_user_settings",
        "employee_permissions",
      ];
      for (const t of l1Tables) await migrateByInstance(t, instanceId);

      // Collect valid IDs for orphan FK filtering
      const customerRows = await readAll("customers", { col: "instance_id", val: instanceId });
      const customerIds = new Set(customerRows.map((r: any) => r.id));
      const employeeRows = await readAll("employees", { col: "instance_id", val: instanceId });
      const employeeIds = new Set(employeeRows.map((r: any) => r.id));
      const columnRows = await readAll("calendar_columns", { col: "instance_id", val: instanceId });
      const columnIds = new Set(columnRows.map((r: any) => r.id));
      const categoryRows = await readAll("customer_categories", { col: "instance_id", val: instanceId });
      const categoryIds = new Set(categoryRows.map((r: any) => r.id));

      // 4. Level-2 tables (depend on L1) — with orphan FK nullification
      const customerAddresses = await readAll("customer_addresses", { col: "instance_id", val: instanceId });
      await writeToTarget("customer_addresses", nullifyOrphanFKs(customerAddresses, ["customer_id"], customerIds));

      const catAssignments = await readAll("customer_category_assignments", { col: "instance_id", val: instanceId });
      const validCatAssignIds = new Set([...customerIds, ...categoryIds]);
      const cleanedCatAssign = catAssignments.filter((r: any) => customerIds.has(r.customer_id) && categoryIds.has(r.category_id));
      await writeToTarget("customer_category_assignments", cleanedCatAssign);

      const breaks = await readAll("breaks", { col: "instance_id", val: instanceId });
      await writeToTarget("breaks", nullifyOrphanFKs(breaks, ["column_id"], columnIds));

      const daysOff = await readAll("employee_days_off", { col: "instance_id", val: instanceId });
      await writeToTarget("employee_days_off", nullifyOrphanFKs(daysOff, ["employee_id"], employeeIds));

      await migrateByInstance("notifications", instanceId);
      await migrateByInstance("push_subscriptions", instanceId);

      // Collect customer_address IDs for further FK filtering
      const addressIds = new Set(customerAddresses.map((r: any) => r.id));
      const projectRows = await readAll("projects", { col: "instance_id", val: instanceId });
      const projectIds = new Set(projectRows.map((r: any) => r.id));

      // 5. Calendar items — with orphan FK nullification
      const calendarItems = await readAll("calendar_items", { col: "instance_id", val: instanceId });
      const cleanedCalItems = nullifyOrphanFKs(
        nullifyOrphanFKs(
          nullifyOrphanFKs(
            nullifyOrphanFKs(calendarItems, ["customer_id"], customerIds),
            ["customer_address_id"], addressIds
          ),
          ["column_id"], columnIds
        ),
        ["project_id"], projectIds
      );
      await writeToTarget("calendar_items", cleanedCalItems);

      const calItemIds = new Set(calendarItems.map((r: any) => r.id));
      const serviceRows = await readAll("unified_services", { col: "instance_id", val: instanceId });
      const serviceIds = new Set(serviceRows.map((r: any) => r.id));

      // 6. Calendar item services
      const calItemServices = await readAll("calendar_item_services", { col: "instance_id", val: instanceId });
      const cleanedCalItemServices = calItemServices.filter(
        (r: any) => calItemIds.has(r.calendar_item_id) && serviceIds.has(r.service_id)
      );
      await writeToTarget("calendar_item_services", cleanedCalItemServices);

      // 7. Reminders
      const reminderTypeRows = await readAll("reminder_types", { col: "instance_id", val: instanceId });
      const reminderTypeIds = new Set(reminderTypeRows.map((r: any) => r.id));
      const reminders = await readAll("reminders", { col: "instance_id", val: instanceId });
      const cleanedReminders = nullifyOrphanFKs(
        nullifyOrphanFKs(reminders, ["customer_id"], customerIds),
        ["reminder_type_id"], reminderTypeIds
      );
      await writeToTarget("reminders", cleanedReminders);

      // 8. SMS logs
      const smsLogs = await readAll("sms_logs", { col: "instance_id", val: instanceId });
      await writeToTarget("sms_logs", nullifyOrphanFKs(smsLogs, ["calendar_item_id"], calItemIds));

      // 9. Customer SMS notifications
      const smsNotifTemplateRows = await readAll("sms_notification_templates", { col: "instance_id", val: instanceId });
      const smsNotifTemplateIds = new Set(smsNotifTemplateRows.map((r: any) => r.id));
      const customerSmsNotifs = await readAll("customer_sms_notifications", { col: "instance_id", val: instanceId });
      const cleanedSmsNotifs = customerSmsNotifs.filter(
        (r: any) => smsNotifTemplateIds.has(r.notification_template_id)
      );
      await writeToTarget("customer_sms_notifications", nullifyOrphanFKs(cleanedSmsNotifs, ["calendar_item_id"], calItemIds));

      // 10. Protocols
      const protocols = await readAll("protocols", { col: "instance_id", val: instanceId });
      const cleanedProtocols = nullifyOrphanFKs(
        nullifyOrphanFKs(
          nullifyOrphanFKs(protocols, ["customer_id"], customerIds),
          ["customer_address_id"], addressIds
        ),
        ["calendar_item_id"], calItemIds
      );
      await writeToTarget("protocols", cleanedProtocols);

      // 11. Invoices
      const invoices = await readAll("invoices", { col: "instance_id", val: instanceId });
      const cleanedInvoices = nullifyOrphanFKs(
        nullifyOrphanFKs(invoices, ["customer_id"], customerIds),
        ["calendar_item_id"], calItemIds
      );
      await writeToTarget("invoices", cleanedInvoices);

      // 12. Time entries
      const timeEntries = await readAll("time_entries", { col: "instance_id", val: instanceId });
      await writeToTarget("time_entries", nullifyOrphanFKs(timeEntries, ["employee_id"], employeeIds));

      // 13. Time entry audit log
      const auditLog = await readAll("time_entry_audit_log", { col: "instance_id", val: instanceId });
      await writeToTarget("time_entry_audit_log", nullifyOrphanFKs(auditLog, ["employee_id"], employeeIds));
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
