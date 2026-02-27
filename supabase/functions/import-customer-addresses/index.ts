import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("00") && !cleaned.startsWith("+")) {
    cleaned = "+" + cleaned.slice(2);
  }
  if (cleaned.startsWith("+")) return cleaned;
  const digitsOnly = cleaned.replace(/\D/g, "");
  if (digitsOnly.length === 9) return "+48" + digitsOnly;
  if (digitsOnly.length > 9) return "+" + digitsOnly;
  return "+" + cleaned;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const tsvText = await req.text();
    const lines = tsvText.split(/\r?\n/).filter((l) => l.trim().length > 0);

    const INSTANCE_ID = "c6300bdc-5070-4599-8143-06926578a424";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all customers with their phones
    const { data: customers } = await supabase
      .from("customers")
      .select("id, phone, name")
      .eq("instance_id", INSTANCE_ID);

    // Build phone -> customer map
    const phoneToCustomer = new Map<string, { id: string; name: string }>();
    for (const c of customers || []) {
      phoneToCustomer.set(c.phone, { id: c.id, name: c.name });
    }

    const addresses: any[] = [];
    const skipped: string[] = [];
    const noCustomer: string[] = [];

    // Skip header row (row 0)
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split("\t");
      // Columns: 0=Lp, 1=Ulica, 2=Miasto, 3=Kod pocztowy, 4=Telefon, 5=Lat, 6=Lng, 7=Status, 8=Adres oryginalny, 9=Znaleziony adres
      const street = (cols[1] || "").trim();
      const city = (cols[2] || "").trim();
      const postalCode = (cols[3] || "").trim();
      const phoneRaw = (cols[4] || "").trim();
      const latStr = (cols[5] || "").trim();
      const lngStr = (cols[6] || "").trim();

      if (!phoneRaw) {
        skipped.push(`Row ${i + 1}: no phone — "${street}" "${city}"`);
        continue;
      }

      if (!street && !city) {
        skipped.push(`Row ${i + 1}: no address data — phone ${phoneRaw}`);
        continue;
      }

      const phone = normalizePhone(phoneRaw);
      const customer = phoneToCustomer.get(phone);

      if (!customer) {
        noCustomer.push(`Row ${i + 1}: phone ${phone} (${phoneRaw}) — "${street}", "${city}" — no matching customer`);
        continue;
      }

      const lat = latStr ? parseFloat(latStr) : null;
      const lng = lngStr ? parseFloat(lngStr) : null;

      // Build address name from street + city
      const name = [street, city].filter(Boolean).join(", ") || "Adres serwisowy";

      addresses.push({
        instance_id: INSTANCE_ID,
        customer_id: customer.id,
        name,
        street: street || null,
        city: city || null,
        postal_code: postalCode || null,
        lat: isNaN(lat as number) ? null : lat,
        lng: isNaN(lng as number) ? null : lng,
        is_default: false,
      });
    }

    // Mark first address per customer as default
    const seenCustomers = new Set<string>();
    for (const addr of addresses) {
      if (!seenCustomers.has(addr.customer_id)) {
        addr.is_default = true;
        seenCustomers.add(addr.customer_id);
      }
    }

    // Insert in batches of 50
    let inserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < addresses.length; i += 50) {
      const batch = addresses.slice(i, i + 50);
      const { error, data } = await supabase
        .from("customer_addresses")
        .insert(batch)
        .select("id");
      if (error) {
        errors.push(`Batch ${i / 50 + 1}: ${error.message}`);
      } else {
        inserted += (data || []).length;
      }
    }

    return new Response(
      JSON.stringify({
        total_rows: lines.length - 1,
        imported: inserted,
        skipped_count: skipped.length,
        skipped_samples: skipped.slice(0, 30),
        no_customer_count: noCustomer.length,
        no_customer_list: noCustomer,
        errors,
        unique_customers: seenCustomers.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
