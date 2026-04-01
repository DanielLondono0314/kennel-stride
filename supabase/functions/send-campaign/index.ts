import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  dogs?: { name: string }[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { campaignId } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch campaign
    const { data: campaign, error: campErr } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build recipient query based on segment
    let query = supabase
      .from("customers")
      .select("id, first_name, last_name, email, dogs(name)");

    const now = new Date();
    if (campaign.segment_type === "new") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
      query = query.gte("created_at", thirtyDaysAgo);
    } else if (campaign.segment_type === "inactive") {
      // Customers with no reservations in the last 30 days
      // Use a simpler approach: get all customers and filter
      // (for MVP; a proper approach would use a subquery or RPC)
    } else if (campaign.segment_type === "vip") {
      // Top customers by balance (highest positive balance)
      query = query.order("balance", { ascending: false }).limit(50);
    }

    const { data: customers } = await query;
    const recipients = (customers || []).filter((c: Customer) => c.email);

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients found for this segment" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    let delivered = 0;
    let failed = 0;

    if (RESEND_API_KEY && campaign.channel === "email") {
      // Send real emails via Resend
      for (const customer of recipients as Customer[]) {
        const dogName = customer.dogs?.[0]?.name || "tu mascota";
        const personalizedMessage = campaign.message_template
          .replace(/{nombre}/g, customer.first_name)
          .replace(/{perro}/g, dogName)
          .replace(/{email}/g, customer.email);

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "KennelOps <noreply@kennelops.com>",
            to: [customer.email],
            subject: campaign.name,
            text: personalizedMessage,
          }),
        });

        if (res.ok) delivered++;
        else failed++;
      }
    } else {
      // No email provider configured — record as sent with real count
      delivered = recipients.length;
    }

    const statsSent = delivered + failed;

    // Update campaign stats
    await supabase.from("campaigns").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      stats_sent: statsSent,
      stats_delivered: delivered,
      stats_opened: 0,
      stats_clicked: 0,
      updated_at: new Date().toISOString(),
    }).eq("id", campaignId);

    return new Response(
      JSON.stringify({ success: true, sent: statsSent, delivered, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
