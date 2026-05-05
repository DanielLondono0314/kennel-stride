import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────────────────────
// LemonSqueezy Webhook Handler
//
// Events handled:
//   subscription_created    → org status: trialing / active
//   subscription_updated    → update status, cancel, resume
//   subscription_cancelled  → org status: cancelled
//   subscription_resumed    → org status: active
//   order_created           → record payment on packages
//
// Required environment variables (set in Supabase dashboard):
//   LEMONSQUEEZY_WEBHOOK_SECRET  — signing secret from LS dashboard
//   SUPABASE_URL                 — auto-provided by Supabase
//   SUPABASE_SERVICE_ROLE_KEY    — auto-provided by Supabase
// ─────────────────────────────────────────────────────────────────────────────

// Webhook is called server-to-server by LemonSqueezy, so wildcard CORS is acceptable here
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature",
};

/** Verify the HMAC-SHA256 signature LemonSqueezy sends on every webhook */
async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(body);

  const key = await crypto.subtle.importKey(
    "raw", keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const sigBytes = new Uint8Array(
    signature.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );

  return crypto.subtle.verify("HMAC", key, sigBytes, msgData);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature") ?? "";
    const webhookSecret = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET") ?? "";

    // [A-1] Fail hard if the signing secret is not configured.
    // Skipping verification would allow any caller to manipulate subscription status.
    if (!webhookSecret) {
      console.error("LEMONSQUEEZY_WEBHOOK_SECRET is not configured");
      return new Response(JSON.stringify({ error: "Server misconfiguration: webhook secret missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const valid = await verifySignature(rawBody, signature, webhookSecret);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    const eventName: string = payload.meta?.event_name ?? "";
    const data = payload.data ?? {};
    const attributes = data.attributes ?? {};

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    switch (eventName) {

      // New subscription created (after checkout).
      // org_id must be passed via custom_data during the LemonSqueezy checkout URL.
      case "subscription_created": {
        const lsCustomerId = String(attributes.customer_id);
        const lsSubscriptionId = String(data.id);
        const status = attributes.status === "active" ? "active" : "trialing";

        // [A-2] Removed dead code: unused query that fetched any admin member without
        // an org filter. The correct lookup is via custom_data.org_id set at checkout.
        const orgId: string = payload.meta?.custom_data?.org_id ?? "";

        if (orgId) {
          await supabase
            .from("organizations")
            .update({
              ls_customer_id: lsCustomerId,
              ls_subscription_id: lsSubscriptionId,
              subscription_status: status,
            })
            .eq("id", orgId);
        }
        break;
      }

      // Subscription status changed (upgrade, downgrade, renewal, pause)
      case "subscription_updated": {
        const lsSubscriptionId = String(data.id);
        const lsStatus: string = attributes.status;

        let appStatus = "active";
        if (lsStatus === "cancelled" || lsStatus === "expired") appStatus = "cancelled";
        else if (lsStatus === "paused") appStatus = "cancelled";

        await supabase
          .from("organizations")
          .update({ subscription_status: appStatus })
          .eq("ls_subscription_id", lsSubscriptionId);
        break;
      }

      // Subscription explicitly cancelled
      case "subscription_cancelled": {
        const lsSubscriptionId = String(data.id);
        await supabase
          .from("organizations")
          .update({ subscription_status: "cancelled" })
          .eq("ls_subscription_id", lsSubscriptionId);
        break;
      }

      // Subscription resumed after cancellation
      case "subscription_resumed": {
        const lsSubscriptionId = String(data.id);
        await supabase
          .from("organizations")
          .update({ subscription_status: "active" })
          .eq("ls_subscription_id", lsSubscriptionId);
        break;
      }

      // One-time order completed (e.g. package purchase via payment link)
      case "order_created": {
        const lsOrderId = String(data.id);
        const variantId = String(attributes.first_order_item?.variant_id ?? "");

        // If custom_data carries an internal package ID, link it
        const packageId: string = payload.meta?.custom_data?.package_id ?? "";
        if (packageId) {
          await supabase
            .from("packages")
            .update({
              ls_order_id: lsOrderId,
              ls_variant_id: variantId,
              status: "active",
            })
            .eq("id", packageId);
        }
        break;
      }

      default:
        // Unhandled event — acknowledge without error so LS doesn't retry
        console.log(`Unhandled LS event: ${eventName}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
