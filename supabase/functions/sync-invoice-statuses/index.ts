import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---- iFirma HMAC helper ----
async function ifirmaHmac(hexKey: string, message: string): Promise<string> {
  const keyData = new Uint8Array(hexKey.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
  const msgData = new TextEncoder().encode(message);
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: { name: "SHA-1" } }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ---- Sync Fakturownia ----
async function syncFakturownia(
  supabase: any,
  instanceId: string,
  config: { domain: string; api_token: string }
) {
  const { data: invoices, error: invError } = await supabase
    .from("invoices")
    .select("id, external_invoice_id, status, calendar_item_id, payment_to")
    .eq("instance_id", instanceId)
    .eq("provider", "fakturownia")
    .not("status", "in", '("paid","cancelled")');

  if (invError) throw invError;
  if (!invoices?.length) return { synced: 0, total: 0 };

  let synced = 0;
  const today = new Date().toISOString().split("T")[0];

  for (const inv of invoices) {
    if (!inv.external_invoice_id) continue;
    try {
      const res = await fetch(
        `https://${config.domain}.fakturownia.pl/invoices/${inv.external_invoice_id}.json?api_token=${config.api_token}`
      );
      if (!res.ok) { console.warn(`Fakturownia fetch failed ${inv.external_invoice_id}: ${res.status}`); continue; }

      const data = await res.json();
      let newStatus = inv.status;
      let newPaymentStatus: string | null = null;

      if (data.status === "paid" || data.paid === true) {
        newStatus = "paid";
        newPaymentStatus = "paid";
      } else if (data.status === "sent") {
        newStatus = "sent";
        newPaymentStatus = "invoice_sent";
      }

      const paymentTo = data.payment_to || inv.payment_to;
      if (newStatus !== "paid" && paymentTo && paymentTo < today) {
        newStatus = "overdue";
        newPaymentStatus = "overdue";
      }

      if (newStatus !== inv.status) {
        const updateData: Record<string, unknown> = { status: newStatus };
        if (data.payment_to) updateData.payment_to = data.payment_to;
        await supabase.from("invoices").update(updateData).eq("id", inv.id);
        if (newPaymentStatus && inv.calendar_item_id) {
          await supabase.from("calendar_items").update({ payment_status: newPaymentStatus }).eq("id", inv.calendar_item_id);
        }
        synced++;
      }
    } catch (e) {
      console.error(`Error syncing fakturownia invoice ${inv.id}:`, e);
    }
  }

  return { synced, total: invoices.length };
}

// ---- Sync iFirma ----
async function syncIfirma(
  supabase: any,
  instanceId: string,
  config: { invoice_api_user: string; invoice_api_key: string }
) {
  const { data: invoices, error: invError } = await supabase
    .from("invoices")
    .select("id, external_invoice_id, status, calendar_item_id, payment_to, invoice_number")
    .eq("instance_id", instanceId)
    .eq("provider", "ifirma")
    .not("status", "in", '("paid","cancelled")');

  if (invError) throw invError;
  if (!invoices?.length) return { synced: 0, total: 0 };

  let synced = 0;
  const today = new Date().toISOString().split("T")[0];

  for (const inv of invoices) {
    if (!inv.external_invoice_id) continue;
    try {
      const url = `https://www.ifirma.pl/iapi/fakturakraj/${inv.external_invoice_id}.json`;
      const messageToSign = `${url}${config.invoice_api_user}faktura`;
      const hmacHash = await ifirmaHmac(config.invoice_api_key, messageToSign);

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authentication: `IAPIS user=${config.invoice_api_user}, hmac-sha1=${hmacHash}`,
        },
      });

      if (!res.ok) {
        console.warn(`iFirma fetch failed ${inv.external_invoice_id}: ${res.status}`);
        continue;
      }

      const data = await res.json();
      console.log(`iFirma invoice ${inv.external_invoice_id} response:`, JSON.stringify(data));

      let newStatus = inv.status;
      let newPaymentStatus: string | null = null;

      // iFirma response contains Zaplacono (amount paid) and RazemBrutto (total gross)
      // and NumerPelny (full invoice number)
      const response = data.response || data;
      const zaplacono = response.Zaplacono ?? 0;
      const razemBrutto = response.WartoscBrutto ?? response.RazemBrutto ?? 0;

      if (zaplacono >= razemBrutto && razemBrutto > 0) {
        newStatus = "paid";
        newPaymentStatus = "paid";
      } else if (zaplacono > 0 && zaplacono < razemBrutto) {
        newStatus = "partial";
        newPaymentStatus = "invoice_sent";
      }

      // Update invoice number if we didn't have it
      const invoiceNumber = response.NumerPelny || null;

      // Check overdue
      const paymentTo = response.TerminPlatnosci || inv.payment_to;
      if (newStatus !== "paid" && paymentTo && paymentTo < today) {
        newStatus = "overdue";
        newPaymentStatus = "overdue";
      }

      if (newStatus !== inv.status || (invoiceNumber && !inv.invoice_number)) {
        const updateData: Record<string, unknown> = { status: newStatus };
        if (invoiceNumber && !inv.invoice_number) updateData.invoice_number = invoiceNumber;
        if (response.TerminPlatnosci) updateData.payment_to = response.TerminPlatnosci;

        await supabase.from("invoices").update(updateData).eq("id", inv.id);

        if (newPaymentStatus && inv.calendar_item_id) {
          await supabase.from("calendar_items").update({ payment_status: newPaymentStatus }).eq("id", inv.calendar_item_id);
        }
        synced++;
      }
    } catch (e) {
      console.error(`Error syncing ifirma invoice ${inv.id}:`, e);
    }
  }

  return { synced, total: invoices.length };
}

// ---- Main Handler ----
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { instanceId } = await req.json();
    if (!instanceId) {
      return new Response(JSON.stringify({ error: "instanceId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings } = await supabase
      .from("invoicing_settings")
      .select("provider, provider_config, active")
      .eq("instance_id", instanceId)
      .maybeSingle();

    if (!settings?.active || !settings.provider) {
      return new Response(JSON.stringify({ error: "Invoicing not configured", synced: 0 }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = settings.provider_config as any;
    let result: { synced: number; total: number };

    if (settings.provider === "fakturownia") {
      result = await syncFakturownia(supabase, instanceId, config);
    } else if (settings.provider === "ifirma") {
      result = await syncIfirma(supabase, instanceId, config);
    } else {
      return new Response(JSON.stringify({ error: `Unknown provider: ${settings.provider}`, synced: 0 }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
