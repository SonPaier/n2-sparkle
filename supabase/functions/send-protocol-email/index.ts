import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { protocolId, recipientEmail, subject, message, instanceId } = await req.json();

    if (!protocolId || !recipientEmail || !subject || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For now, return success - actual email sending requires an email provider (e.g. Resend)
    // This is a placeholder that logs the intent
    console.log(`[send-protocol-email] Would send email to ${recipientEmail} for protocol ${protocolId}`);
    console.log(`Subject: ${subject}`);
    console.log(`Message: ${message}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Email sending placeholder - configure email provider' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[send-protocol-email] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
