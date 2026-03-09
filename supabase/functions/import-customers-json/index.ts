import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceId, data: items } = await req.json();

    if (!instanceId) {
      return new Response(
        JSON.stringify({ error: "instanceId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: any[] = [];

    for (const item of items) {
      const c = item.customer;
      const customerData: Record<string, any> = {
        instance_id: instanceId,
        name: c.name,
      };
      const optionalFields = [
        'short_name', 'phone', 'email', 'company', 'nip', 'vat_eu_number',
        'contact_person', 'contact_phone', 'contact_email', 'additional_contacts',
        'address', 'billing_street', 'billing_street_line2', 'billing_city',
        'billing_postal_code', 'billing_region', 'billing_country_code',
        'country_code', 'default_currency', 'notes', 'sales_notes', 'source',
      ];
      for (const f of optionalFields) {
        if (c[f] !== null && c[f] !== undefined) {
          customerData[f] = c[f];
        }
      }

      const { data: inserted, error: custErr } = await supabase
        .from("customers")
        .insert(customerData)
        .select("id")
        .single();

      if (custErr) {
        results.push({ name: c.name, error: custErr.message });
        continue;
      }

      const customerId = inserted.id;

      const addresses = (item.customer_addresses || []).map((a: any) => {
        const addr: Record<string, any> = {
          instance_id: instanceId,
          customer_id: customerId,
          name: a.name || "Adres główny",
        };
        const addrFields = [
          'street', 'street_line2', 'city', 'postal_code', 'region',
          'country_code', 'lat', 'lng', 'contact_person', 'contact_phone',
          'contacts', 'notes', 'is_default', 'sort_order',
        ];
        for (const f of addrFields) {
          if (a[f] !== null && a[f] !== undefined) {
            addr[f] = a[f];
          }
        }
        return addr;
      });

      let addrCount = 0;
      if (addresses.length > 0) {
        const { data: addrData, error: addrErr } = await supabase
          .from("customer_addresses")
          .insert(addresses)
          .select("id");
        if (addrErr) {
          results.push({ name: c.name, customerId, addressError: addrErr.message });
          continue;
        }
        addrCount = (addrData || []).length;
      }

      results.push({ name: c.name, customerId, addresses: addrCount });
    }

    return new Response(
      JSON.stringify({ imported: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
