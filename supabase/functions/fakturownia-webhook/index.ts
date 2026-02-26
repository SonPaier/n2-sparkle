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

  // Fakturownia sends POST with JSON payload
  if (req.method !== "POST") {
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { deal, api_token } = payload;

    // Fakturownia sends deal object with invoice data
    if (!deal) {
      console.log("No deal in payload, ignoring");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Get the external invoice ID from the deal
    const externalId = deal.id ? String(deal.id) : null;
    if (!externalId) {
      console.log("No deal.id in payload, ignoring");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Use service role to bypass RLS — this is a server-to-server webhook
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find invoice by external_invoice_id
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("id, instance_id, status, calendar_item_id")
      .eq("external_invoice_id", externalId)
      .eq("provider", "fakturownia")
      .maybeSingle();

    if (invError) {
      console.error("Error finding invoice:", invError);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (!invoice) {
      console.log(`Invoice with external_invoice_id=${externalId} not found, ignoring`);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Verify api_token matches the instance's config
    if (api_token) {
      const { data: settings } = await supabase
        .from("invoicing_settings")
        .select("provider_config")
        .eq("instance_id", invoice.instance_id)
        .maybeSingle();

      const config = settings?.provider_config as { api_token?: string } | null;
      if (config?.api_token && config.api_token !== api_token) {
        console.warn("API token mismatch, rejecting webhook");
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
    }

    // Map Fakturownia status to our status
    let newInvoiceStatus = invoice.status;
    let newPaymentStatus: string | null = null;

    if (deal.status === "paid" || deal.paid === true) {
      newInvoiceStatus = "paid";
      newPaymentStatus = "paid";
    } else if (deal.status === "partial") {
      newInvoiceStatus = "sent"; // partial payment — keep as sent
      newPaymentStatus = "invoice_sent";
    } else if (deal.status === "rejected") {
      newInvoiceStatus = "draft";
      newPaymentStatus = "not_invoiced";
    } else if (deal.status === "sent") {
      newInvoiceStatus = "sent";
      newPaymentStatus = "invoice_sent";
    }

    // Update invoice status
    if (newInvoiceStatus !== invoice.status) {
      const updateData: Record<string, unknown> = { status: newInvoiceStatus };

      // Also update payment_to if available from deal
      if (deal.payment_to) {
        updateData.payment_to = deal.payment_to;
      }

      await supabase
        .from("invoices")
        .update(updateData)
        .eq("id", invoice.id);

      console.log(`Invoice ${invoice.id} status updated to ${newInvoiceStatus}`);
    }

    // Update linked calendar_item payment_status
    if (newPaymentStatus && invoice.calendar_item_id) {
      await supabase
        .from("calendar_items")
        .update({ payment_status: newPaymentStatus })
        .eq("id", invoice.calendar_item_id);

      console.log(`Calendar item ${invoice.calendar_item_id} payment_status updated to ${newPaymentStatus}`);
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Always return 200 to Fakturownia — they don't retry
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
