import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { targetInstanceId, customers, addresses } = await req.json();

    if (!targetInstanceId || !customers?.length) {
      return new Response(
        JSON.stringify({ error: "targetInstanceId and customers are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Map old customer ID -> new customer ID
    const idMap = new Map<string, string>();
    let customersInserted = 0;
    let addressesInserted = 0;
    const errors: string[] = [];

    // Insert customers in batches of 50
    for (let i = 0; i < customers.length; i += 50) {
      const batch = customers.slice(i, i + 50);
      const rows = batch.map((c: any) => {
        const { id: oldId, instance_id, created_at, updated_at, ...rest } = c;
        return { ...rest, instance_id: targetInstanceId };
      });

      const { data, error } = await supabase
        .from("customers")
        .insert(rows)
        .select("id, name");

      if (error) {
        errors.push(`Customers batch ${Math.floor(i / 50) + 1}: ${error.message}`);
        continue;
      }

      // Map old IDs to new IDs by position (same order)
      for (let j = 0; j < batch.length; j++) {
        if (data?.[j]) {
          idMap.set(batch[j].id, data[j].id);
        }
      }
      customersInserted += (data || []).length;
    }

    // Insert addresses in batches of 50
    if (addresses?.length) {
      for (let i = 0; i < addresses.length; i += 50) {
        const batch = addresses.slice(i, i + 50);
        const rows = batch
          .map((a: any) => {
            const newCustomerId = idMap.get(a.customer_id);
            if (!newCustomerId) return null;

            const { id: _oldId, instance_id, customer_id, created_at, updated_at, ...rest } = a;
            return {
              ...rest,
              instance_id: targetInstanceId,
              customer_id: newCustomerId,
            };
          })
          .filter(Boolean);

        if (rows.length === 0) continue;

        const { data, error } = await supabase
          .from("customer_addresses")
          .insert(rows)
          .select("id");

        if (error) {
          errors.push(`Addresses batch ${Math.floor(i / 50) + 1}: ${error.message}`);
        } else {
          addressesInserted += (data || []).length;
        }
      }
    }

    return new Response(
      JSON.stringify({
        customersInserted,
        addressesInserted,
        mappedIds: idMap.size,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
