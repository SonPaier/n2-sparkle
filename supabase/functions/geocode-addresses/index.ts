import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const instanceId = url.searchParams.get("instance_id");

    if (!instanceId) {
      return new Response(JSON.stringify({ error: "instance_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();

      // Support two modes:
      // 1. { addresses: [{ id, lat, lng }] } - update by ID
      // 2. { match_addresses: [{ address, lat, lng }] } - match by city+street text
      if (body.addresses) {
        const { addresses } = body;
        let updated = 0;
        const errors: string[] = [];
        for (const addr of addresses) {
          if (!addr.id || addr.lat == null || addr.lng == null) continue;
          const { error } = await supabase
            .from("customer_addresses")
            .update({ lat: addr.lat, lng: addr.lng })
            .eq("id", addr.id)
            .eq("instance_id", instanceId);
          if (error) errors.push(`${addr.id}: ${error.message}`);
          else updated++;
        }
        return new Response(JSON.stringify({ updated, errors }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.match_addresses) {
        // Fetch ALL addresses for instance
        let allAddresses: any[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("customer_addresses")
            .select("id, street, city")
            .eq("instance_id", instanceId)
            .range(from, from + pageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allAddresses = allAddresses.concat(data);
          if (data.length < pageSize) break;
          from += pageSize;
        }

        // Build lookup: "normalized_city|normalized_street" -> address id(s)
        const lookup = new Map<string, string[]>();
        for (const a of allAddresses) {
          const key = normalize(a.city) + "|" + normalize(a.street);
          if (!lookup.has(key)) lookup.set(key, []);
          lookup.get(key)!.push(a.id);
        }

        let updated = 0;
        const notFound: string[] = [];
        const errors: string[] = [];

        for (const entry of body.match_addresses) {
          if (!entry.address || entry.lat == null || entry.lng == null) continue;
          if (entry.lat === "-" || entry.lng === "-") continue;

          const lat = parseFloat(entry.lat);
          const lng = parseFloat(entry.lng);
          if (isNaN(lat) || isNaN(lng)) continue;

          // Parse "City, Street" format
          const parts = entry.address.split(",").map((s: string) => s.trim());
          const city = parts[0] || "";
          const street = parts.slice(1).join(", ") || "";

          const key = normalize(city) + "|" + normalize(street);
          const ids = lookup.get(key);

          if (!ids || ids.length === 0) {
            notFound.push(entry.address);
            continue;
          }

          for (const id of ids) {
            const { error } = await supabase
              .from("customer_addresses")
              .update({ lat, lng })
              .eq("id", id);
            if (error) errors.push(`${entry.address}: ${error.message}`);
            else updated++;
          }
        }

        return new Response(
          JSON.stringify({
            total_input: body.match_addresses.length,
            updated,
            not_found_count: notFound.length,
            not_found: notFound,
            errors,
            db_addresses_count: allAddresses.length,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ error: "Provide 'addresses' or 'match_addresses'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET - export addresses without lat/lng
    const { data, error } = await supabase
      .from("customer_addresses")
      .select("id, street, city, postal_code")
      .eq("instance_id", instanceId)
      .or("lat.is.null,lng.is.null")
      .order("city")
      .order("street");

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=addresses_to_geocode.json",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
