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

    // Get existing phones to avoid duplicates
    const { data: existing } = await supabase
      .from("customers")
      .select("phone")
      .eq("instance_id", INSTANCE_ID);
    const existingPhones = new Set(
      (existing || []).map((c: { phone: string }) => c.phone)
    );

    const customers: any[] = [];
    const skipped: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split("\t");
      // Columns: 0=address, 1=name, 2=phone, 3=email, 4=nip
      const address = (cols[0] || "").trim();
      const nameRaw = (cols[1] || "").trim();
      const phoneRaw = (cols[2] || "").trim();
      const email = (cols[3] || "").trim();
      const nip = (cols[4] || "").trim();

      // Skip rows without phone (empty rows, section headers)
      if (!phoneRaw) {
        skipped.push(`Row ${i + 1}: no phone — "${address}" "${nameRaw}"`);
        continue;
      }

      const phone = normalizePhone(phoneRaw);
      if (existingPhones.has(phone)) {
        skipped.push(`Row ${i + 1}: duplicate phone ${phone}`);
        continue;
      }

      // Name: use address if name is empty
      const name = nameRaw || address || `Klient ${i + 1}`;

      // Split address: first word = city, rest = street
      let billingCity = "";
      let billingStreet = "";
      if (address) {
        const parts = address.split(/\s+/);
        billingCity = parts[0] || "";
        billingStreet = parts.slice(1).join(" ") || "";
      }

      customers.push({
        instance_id: INSTANCE_ID,
        name,
        phone,
        email: email || null,
        nip: nip || null,
        billing_city: billingCity || null,
        billing_street: billingStreet || null,
        source: "csv_import",
      });

      existingPhones.add(phone);
    }

    // Insert in batches of 50
    let inserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < customers.length; i += 50) {
      const batch = customers.slice(i, i + 50);
      const { error, data } = await supabase
        .from("customers")
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
        total_rows: lines.length,
        imported: inserted,
        skipped_count: skipped.length,
        skipped_samples: skipped.slice(0, 30),
        errors,
        first_customer: customers[0],
        last_customer: customers[customers.length - 1],
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
