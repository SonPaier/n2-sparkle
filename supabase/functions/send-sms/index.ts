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
    const { phone, message, instanceId, notificationId, calendarItemId, messageType, sentBy } = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: "phone and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const smsApiToken = Deno.env.get("SMSAPI_TOKEN");

    // Build the final message with short_name from instance
    let finalMessage = message;
    if (instanceId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: instance } = await supabase
        .from("instances")
        .select("short_name, reservation_phone, phone")
        .eq("id", instanceId)
        .single();

      if (instance) {
        const shortName = instance.short_name || "";
        const reservationPhone = instance.reservation_phone || instance.phone || "";
        // Replace placeholders - backend always uses short_name from DB
        finalMessage = finalMessage
          .replace(/\{short_name\}/g, shortName)
          .replace(/\{reservation_phone\}/g, reservationPhone);
      }
    }

    // If no SMSAPI token, log and return success (dev mode)
    if (!smsApiToken) {
      console.log("[DEV MODE] SMS would be sent to:", phone);
      console.log("[DEV MODE] Message:", finalMessage);

      // Update notification status if notificationId provided
      if (notificationId) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from("customer_sms_notifications")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", notificationId);
      }

      return new Response(
        JSON.stringify({ success: true, dev_mode: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via SMSAPI
    const formData = new URLSearchParams();
    formData.append("to", phone.replace(/\D/g, ""));
    formData.append("message", finalMessage);
    formData.append("format", "json");
    formData.append("encoding", "utf-8");

    const smsResponse = await fetch("https://api.smsapi.pl/sms.do", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${smsApiToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const smsResult = await smsResponse.text();
    console.log("SMSAPI response:", smsResult);

    let parsed: any;
    try {
      parsed = JSON.parse(smsResult);
    } catch {
      parsed = { raw: smsResult };
    }

    const isSuccess = parsed?.count > 0 || parsed?.list?.length > 0;

    // Update notification record
    if (notificationId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      if (isSuccess) {
        await supabase
          .from("customer_sms_notifications")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", notificationId);
      } else {
        await supabase
          .from("customer_sms_notifications")
          .update({ status: "failed" })
          .eq("id", notificationId);
      }
    }

    // Log to sms_logs if calendarItemId provided
    if (calendarItemId && messageType) {
      const logSupabase = createClient(supabaseUrl, supabaseServiceKey);
      await logSupabase
        .from("sms_logs")
        .insert({
          instance_id: instanceId,
          calendar_item_id: calendarItemId,
          phone: phone.replace(/\D/g, ""),
          message: finalMessage,
          message_type: messageType,
          status: isSuccess ? "sent" : "failed",
          sent_by: sentBy || null,
        });
    }

    return new Response(
      JSON.stringify({ success: isSuccess, result: parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-sms:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
