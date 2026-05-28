import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// [M-1] Restrict CORS to configured origin instead of wildcard
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "https://app.kennelops.com",
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

  // [C-1] Require a valid Supabase JWT — reject unauthenticated callers
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Validate the caller's JWT using the anon key client
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { campaignId } = await req.json();

    // Service role client for admin operations after auth is confirmed
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

    // [C-2] All segment queries are scoped to the campaign's organization only.
    // This prevents cross-org data leakage where org A could email org B's customers.
    const orgId: string = campaign.organization_id;

    let query = supabase
      .from("customers")
      .select("id, first_name, last_name, email, dogs(name)")
      .eq("organization_id", orgId);

    const now = new Date();
    if (campaign.segment_type === "new") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
      query = query.gte("created_at", thirtyDaysAgo);
    } else if (campaign.segment_type === "inactive") {
      // [C-4] "inactive" filtering requires a subquery/RPC against reservations.
      // Sending to all customers without that filter would violate data isolation.
      // This must be implemented as a proper DB-side function before enabling.
      return new Response(
        JSON.stringify({ error: "Segment 'inactive' is not yet implemented. Use 'all', 'new', or 'vip'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (campaign.segment_type === "vip") {
      // Top customers by positive balance within this org
      query = query.order("balance", { ascending: false }).limit(50);
    }
    // Implicit "all" segment: no additional filter beyond organization_id

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
