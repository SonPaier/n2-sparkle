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

    // Check if this is an UPDATE request
    if (req.method === "POST") {
      const { addresses } = await req.json();
      // addresses = [{ id, lat, lng }, ...]
      let updated = 0;
      const errors: string[] = [];

      for (let i = 0; i < addresses.length; i += 50) {
        const batch = addresses.slice(i, i + 50);
        for (const addr of batch) {
          if (!addr.id || addr.lat == null || addr.lng == null) continue;
          const { error } = await supabase
            .from("customer_addresses")
            .update({ lat: addr.lat, lng: addr.lng })
            .eq("id", addr.id)
            .eq("instance_id", instanceId);
          if (error) {
            errors.push(`${addr.id}: ${error.message}`);
          } else {
            updated++;
          }
        }
      }

      return new Response(
        JSON.stringify({ updated, errors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
