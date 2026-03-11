import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUCKETS = [
  "instance-logos",
  "employee-photos",
  "protocol-photos",
  "media-files",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const body = await req.json();
    const dryRun = body.dry_run ?? true;
    const batchLimit = body.batch_limit ?? 200;
    const targetUrl = body.target_url;
    const targetKey = body.target_service_role_key;

    if (!targetUrl || !targetKey) {
      return new Response(JSON.stringify({ error: "Missing target_url or target_service_role_key" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const source = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
    const target = createClient(targetUrl, targetKey);

    const log: string[] = [];
    const errors: string[] = [];
    let totalFiles = 0;
    let totalMigrated = 0;
    let totalSkipped = 0;

    const listAllFiles = async (bucket: string, prefix = "", limit = 1000): Promise<string[]> => {
      const paths: string[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await source.storage
          .from(bucket).list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
        if (error) { errors.push(`${bucket}/${prefix}: list error - ${error.message}`); return paths; }
        if (!data || data.length === 0) { hasMore = false; break; }
        for (const item of data) {
          const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
          if (item.id === null) {
            const subPaths = await listAllFiles(bucket, fullPath, limit);
            paths.push(...subPaths);
          } else {
            paths.push(fullPath);
          }
        }
        offset += data.length;
        if (data.length < limit) hasMore = false;
      }
      return paths;
    };

    for (const bucket of BUCKETS) {
      log.push(`--- Bucket: ${bucket} ---`);
      const files = await listAllFiles(bucket);
      totalFiles += files.length;
      log.push(`${bucket}: ${files.length} plików znalezionych`);

      if (dryRun) {
        if (files.length > 0) log.push(`${bucket}: przykład: ${files.slice(0, 3).join(", ")}`);
        continue;
      }

      let migrated = 0;
      let skipped = 0;

      for (const filePath of files) {
        if (migrated >= batchLimit) {
          log.push(`${bucket}: osiągnięto limit batcha (${batchLimit}), uruchom ponownie`);
          break;
        }
        try {
          const dir = filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/")) : "";
          const fileName = filePath.includes("/") ? filePath.substring(filePath.lastIndexOf("/") + 1) : filePath;
          const { data: existingList } = await target.storage.from(bucket).list(dir, { limit: 1, search: fileName });
          if (existingList && existingList.some((f: any) => f.name === fileName && f.id !== null)) {
            skipped++;
            continue;
          }
          const { data: fileData, error: downloadError } = await source.storage.from(bucket).download(filePath);
          if (downloadError || !fileData) { errors.push(`${bucket}/${filePath}: download error`); continue; }
          const { error: uploadError } = await target.storage.from(bucket).upload(filePath, fileData, {
            upsert: false, contentType: fileData.type || "application/octet-stream",
          });
          if (uploadError) {
            if (uploadError.message?.includes("already exists") || uploadError.message?.includes("Duplicate")) skipped++;
            else errors.push(`${bucket}/${filePath}: upload error - ${uploadError.message}`);
          } else {
            migrated++;
          }
        } catch (e) {
          errors.push(`${bucket}/${filePath}: ${String(e)}`);
        }
      }
      totalMigrated += migrated;
      totalSkipped += skipped;
      log.push(`${bucket}: ${migrated} przesłanych, ${skipped} pominiętych`);
    }

    return new Response(JSON.stringify({
      success: true, dry_run: dryRun, total_files: totalFiles,
      total_migrated: totalMigrated, total_skipped: totalSkipped, log, errors,
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err), stack: (err as Error)?.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
