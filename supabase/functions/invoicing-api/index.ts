import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---- Fakturownia Strategy ----

async function fakturowniaCreateInvoice(
  config: { domain: string; api_token: string },
  invoiceData: any
) {
  const url = `https://${config.domain}.fakturownia.pl/invoices.json`;
  const body = {
    api_token: config.api_token,
    invoice: {
      kind: invoiceData.kind || "vat",
      number: null,
      sell_date: invoiceData.sell_date,
      issue_date: invoiceData.issue_date,
      payment_to: invoiceData.payment_to,
      buyer_name: invoiceData.buyer_name,
      buyer_tax_no: invoiceData.buyer_tax_no || "",
      buyer_email: invoiceData.buyer_email || "",
      buyer_city: invoiceData.buyer_city || "",
      buyer_street: invoiceData.buyer_street || "",
      buyer_post_code: invoiceData.buyer_post_code || "",
      currency: invoiceData.currency || "PLN",
      oid: invoiceData.oid || null,
      oid_unique: invoiceData.oid ? "yes" : undefined,
      positions: invoiceData.positions.map((p: any) => ({
        name: p.name,
        tax: p.vat_rate === -1 ? "disabled" : String(p.vat_rate),
        total_price_gross: Number(p.unit_price_gross) * Number(p.quantity),
        quantity: Number(p.quantity),
      })),
      ...(invoiceData.client_id ? { client_id: invoiceData.client_id } : {}),
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fakturownia API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    external_invoice_id: String(data.id),
    external_client_id: data.client_id ? String(data.client_id) : null,
    invoice_number: data.number || null,
    pdf_url: `https://${config.domain}.fakturownia.pl/invoices/${data.id}.pdf?api_token=${config.api_token}`,
  };
}

async function fakturowniaSendEmail(
  config: { domain: string; api_token: string },
  externalId: string
) {
  const url = `https://${config.domain}.fakturownia.pl/invoices/${externalId}/send_by_email.json?api_token=${config.api_token}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fakturownia send_by_email error ${res.status}: ${text}`);
  }
  return true;
}

async function fakturowniaTestConnection(config: { domain: string; api_token: string }) {
  const url = `https://${config.domain}.fakturownia.pl/invoices.json?period=last_5&page=1&per_page=1&api_token=${config.api_token}`;
  const res = await fetch(url);
  return res.ok;
}

// ---- iFirma Strategy ----

async function ifirmaHmac(hexKey: string, message: string): Promise<string> {
  // Decode hex key to raw bytes
  const keyData = new Uint8Array(hexKey.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
  const msgData = new TextEncoder().encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: { name: "SHA-1" } },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const byteArray = new Uint8Array(signature);
  return Array.from(byteArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function ifirmaCreateInvoice(
  config: { invoice_api_user: string; invoice_api_key: string },
  invoiceData: any
) {
  const url = "https://www.ifirma.pl/iapi/fakturakraj.json";

  const positions = invoiceData.positions.map((p: any) => ({
    StawkaVat: p.vat_rate === -1 ? 0 : Number(p.vat_rate) / 100,
    Ilosc: Number(p.quantity),
    CenaJednostkowa: Number(p.unit_price_gross),
    NazwaPelna: p.name,
    Jednostka: p.unit || "szt",
    TypStawkiVat: p.vat_rate === -1 ? "ZW" : "PRC",
  }));

  const kontrahent: Record<string, any> = {
    Nazwa: invoiceData.buyer_name,
    KodPocztowy: invoiceData.buyer_post_code || "00-000",
    Miejscowosc: invoiceData.buyer_city || "-",
  };

  if (invoiceData.buyer_tax_no) kontrahent.NIP = invoiceData.buyer_tax_no;
  if (invoiceData.buyer_email) kontrahent.Email = invoiceData.buyer_email;
  if (invoiceData.buyer_street) kontrahent.Ulica = invoiceData.buyer_street;
  if (invoiceData.buyer_country) kontrahent.Kraj = invoiceData.buyer_country;

  const body: Record<string, any> = {
    Zaplacono: 0,
    LiczOd: "BRT",
    RodzajPodpisuOdbiorcy: "BPO",
    DataWystawienia: invoiceData.issue_date,
    DataSprzedazy: invoiceData.sell_date,
    FormatDatySprzedazy: "DZN",
    SposobZaplaty: "PRZ",
    Pozycje: positions,
    Kontrahent: kontrahent,
  };

  if (invoiceData.payment_to) body.TerminPlatnosci = invoiceData.payment_to;
  if (invoiceData.issue_place) body.MiejsceWystawienia = invoiceData.issue_place;
  if (invoiceData.issuer_signature) body.PodpisWystawcy = invoiceData.issuer_signature;

  const bodyStr = JSON.stringify(body);
  console.log("iFirma request body:", bodyStr);
  const messageToSign = `${url}${config.invoice_api_user}faktura${bodyStr}`;
  const hmacHash = await ifirmaHmac(config.invoice_api_key, messageToSign);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authentication: `IAPIS user=${config.invoice_api_user}, hmac-sha1=${hmacHash}`,
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`iFirma API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  console.log("iFirma response:", JSON.stringify(data));

  if (!data?.response?.Identyfikator) {
    throw new Error(`iFirma create_invoice validation failed: ${JSON.stringify(data)}`);
  }

  return {
    external_invoice_id: String(data.response.Identyfikator),
    external_client_id: null,
    invoice_number: data.response?.NumerPelny || null,
    pdf_url: null,
  };
}

async function ifirmaSendEmail(
  config: { invoice_api_user: string; invoice_api_key: string },
  externalId: string,
  buyerEmail?: string
) {
  const url = `https://www.ifirma.pl/iapi/fakturakraj/send/${externalId}.json`;
  const body: Record<string, any> = {};
  if (buyerEmail) body.SkrzynkaEmailOdbiorcy = buyerEmail;
  const bodyStr = JSON.stringify(body);
  const messageToSign = `${url}${config.invoice_api_user}faktura${bodyStr}`;
  const hmacHash = await ifirmaHmac(config.invoice_api_key, messageToSign);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authentication: `IAPIS user=${config.invoice_api_user}, hmac-sha1=${hmacHash}`,
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`iFirma send email error ${res.status}: ${text}`);
  }
  return true;
}

async function ifirmaTestConnection(config: { invoice_api_user: string; invoice_api_key: string }) {
  try {
    const url = "https://www.ifirma.pl/iapi/abonent/miesiacksiegowy.json";
    const messageToSign = `${url}${config.invoice_api_user}abonent`;
    const hmacHash = await ifirmaHmac(config.invoice_api_key, messageToSign);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authentication: `IAPIS user=${config.invoice_api_user}, hmac-sha1=${hmacHash}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, instanceId, ...params } = await req.json();

    // For test_connection, use provided config directly
    if (action === "test_connection") {
      const { provider, config } = params;
      let success = false;
      if (provider === "fakturownia") {
        success = await fakturowniaTestConnection(config);
      } else if (provider === "ifirma") {
        success = await ifirmaTestConnection(config);
      }
      return new Response(JSON.stringify({ success }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch settings
    const { data: settings, error: settingsError } = await supabase
      .from("invoicing_settings")
      .select("*")
      .eq("instance_id", instanceId)
      .single();

    if (settingsError || !settings?.active || !settings.provider) {
      return new Response(
        JSON.stringify({ error: "Invoicing not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const provider = settings.provider;
    const config = settings.provider_config as any;

    if (action === "create_invoice") {
      const { invoiceData, calendarItemId, customerId, autoSendEmail } = params;

      let result: any;

      if (provider === "fakturownia") {
        result = await fakturowniaCreateInvoice(config, invoiceData);
      } else if (provider === "ifirma") {
        result = await ifirmaCreateInvoice(config, invoiceData);
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }

      // Save invoice record
      const { data: invoice, error: insertError } = await supabase
        .from("invoices")
        .insert({
          instance_id: instanceId,
          calendar_item_id: calendarItemId || null,
          customer_id: customerId || null,
          provider,
          external_invoice_id: result.external_invoice_id,
          external_client_id: result.external_client_id,
          invoice_number: result.invoice_number,
          kind: invoiceData.kind || "vat",
          status: "issued",
          issue_date: invoiceData.issue_date,
          sell_date: invoiceData.sell_date,
          payment_to: invoiceData.payment_to,
          buyer_name: invoiceData.buyer_name,
          buyer_tax_no: invoiceData.buyer_tax_no,
          buyer_email: invoiceData.buyer_email,
          positions: invoiceData.positions,
          total_gross: invoiceData.positions.reduce(
            (sum: number, p: any) => sum + p.unit_price_gross * p.quantity,
            0
          ),
          currency: invoiceData.currency || "PLN",
          pdf_url: result.pdf_url,
          oid: calendarItemId || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update calendar item payment status
      if (calendarItemId) {
        await supabase
          .from("calendar_items")
          .update({ payment_status: "invoice_sent" } as any)
          .eq("id", calendarItemId);
      }

      // Auto send email if requested
      if (autoSendEmail && result.external_invoice_id) {
        try {
          if (provider === "fakturownia") {
            await fakturowniaSendEmail(config, result.external_invoice_id);
          } else if (provider === "ifirma") {
            await ifirmaSendEmail(config, result.external_invoice_id, invoiceData.buyer_email);
          }
          await supabase
            .from("invoices")
            .update({ status: "sent" })
            .eq("id", invoice.id);
        } catch (e) {
          console.error("Auto-send email failed:", e);
        }
      }

      return new Response(JSON.stringify({ success: true, invoice }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_invoice") {
      const { invoiceId } = params;
      const { data: inv } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (!inv?.external_invoice_id) {
        throw new Error("Invoice not found or no external ID");
      }

      if (provider === "fakturownia") {
        await fakturowniaSendEmail(config, inv.external_invoice_id);
      } else if (provider === "ifirma") {
        await ifirmaSendEmail(config, inv.external_invoice_id, inv.buyer_email);
      }

      await supabase.from("invoices").update({ status: "sent" }).eq("id", invoiceId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_pdf_url") {
      const { invoiceId } = params;
      const { data: inv } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (!inv) throw new Error("Invoice not found");

      let pdfUrl = inv.pdf_url;
      if (!pdfUrl && provider === "fakturownia" && inv.external_invoice_id) {
        pdfUrl = `https://${config.domain}.fakturownia.pl/invoices/${inv.external_invoice_id}.pdf?api_token=${config.api_token}`;
      }

      return new Response(JSON.stringify({ pdf_url: pdfUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_ifirma_pdf") {
      const { invoiceId } = params;
      const { data: inv } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (!inv?.external_invoice_id) throw new Error("Invoice not found");
      if (provider !== "ifirma") throw new Error("Not an iFirma invoice");

      const pdfUrl = `https://www.ifirma.pl/iapi/fakturakraj/${inv.external_invoice_id}.pdf`;
      const messageToSign = `${pdfUrl}${config.invoice_api_user}faktura`;
      const hmacHash = await ifirmaHmac(config.invoice_api_key, messageToSign);

      const pdfRes = await fetch(pdfUrl, {
        method: "GET",
        headers: {
          Accept: "application/pdf",
          Authentication: `IAPIS user=${config.invoice_api_user}, hmac-sha1=${hmacHash}`,
        },
      });

      if (!pdfRes.ok) {
        const text = await pdfRes.text();
        throw new Error(`iFirma PDF error ${pdfRes.status}: ${text}`);
      }

      const pdfData = await pdfRes.arrayBuffer();
      return new Response(pdfData, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="faktura-${inv.invoice_number || inv.external_invoice_id}.pdf"`,
        },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Invoicing API error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
