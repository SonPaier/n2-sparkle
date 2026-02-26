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

    // Use service role for DB operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get invoicing settings
    const { data: settings } = await supabase
      .from("invoicing_settings")
      .select("provider, provider_config, active")
      .eq("instance_id", instanceId)
      .maybeSingle();

    if (!settings?.active || settings.provider !== "fakturownia") {
      return new Response(JSON.stringify({ error: "Fakturownia not configured", synced: 0 }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = settings.provider_config as { domain: string; api_token: string };

    // Get unpaid invoices from this instance
    const { data: invoices, error: invError } = await supabase
      .from("invoices")
      .select("id, external_invoice_id, status, calendar_item_id, payment_to")
      .eq("instance_id", instanceId)
      .eq("provider", "fakturownia")
      .not("status", "in", '("paid","cancelled")');

    if (invError) throw invError;
    if (!invoices || invoices.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: "No invoices to sync" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let synced = 0;
    const today = new Date().toISOString().split("T")[0];

    for (const inv of invoices) {
      if (!inv.external_invoice_id) continue;

      try {
        const res = await fetch(
          `https://${config.domain}.fakturownia.pl/invoices/${inv.external_invoice_id}.json?api_token=${config.api_token}`
        );

        if (!res.ok) {
          console.warn(`Failed to fetch invoice ${inv.external_invoice_id}: ${res.status}`);
          continue;
        }

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

        // Check overdue: payment_to < today and not paid
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
            await supabase
              .from("calendar_items")
              .update({ payment_status: newPaymentStatus })
              .eq("id", inv.calendar_item_id);
          }

          synced++;
        }
      } catch (e) {
        console.error(`Error syncing invoice ${inv.id}:`, e);
      }
    }

    return new Response(JSON.stringify({ synced, total: invoices.length }), {
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
