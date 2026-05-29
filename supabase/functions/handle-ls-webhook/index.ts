import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
// Idempotency: every event is recorded in public.processed_webhooks keyed by a
// stable event id. Duplicate deliveries (LemonSqueezy retries on non-2xx) are
// acknowledged with 200 without reprocessing. See migration
// 20260529050000_webhook_idempotency.sql.
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

/** SHA-256 hex digest, used as an idempotency fallback when LS omits an id. */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derive a stable id for this delivery so retries dedupe correctly.
 * Prefer an explicit LS-provided id; otherwise hash the verified raw body.
 * The signature is excluded so identical payloads always map to the same id.
 */
async function deriveEventId(payload: Record<string, unknown>, rawBody: string): Promise<string> {
  const meta = (payload?.meta ?? {}) as Record<string, unknown>;
  const explicit = meta.webhook_id ?? meta.event_id ?? meta.id;
  if (explicit) return `ls_${String(explicit)}`;
  return `ls_sha256_${await sha256Hex(rawBody)}`;
}

/** Run an update, log any error, and report whether a row was actually matched. */
async function runUpdate(
  label: string,
  builder: PromiseLike<{ error: unknown; data: unknown }>,
): Promise<void> {
  const { error, data } = await builder;
  if (error) {
    console.error(`[${label}] update failed:`, error);
    return;
  }
  const rows = Array.isArray(data) ? data.length : 0;
  if (rows === 0) {
    console.warn(`[${label}] update matched no rows`);
  }
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

    const supabase: SupabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // [E3] Idempotency guard. Claim this event by inserting its id; if the row
    // already exists, ON CONFLICT DO NOTHING returns zero rows and we ack without
    // reprocessing. We claim BEFORE handling so a retry arriving while the first
    // is still in-flight cannot double-apply.
    const eventId = await deriveEventId(payload, rawBody);
    const { data: claimed, error: claimErr } = await supabase
      .from("processed_webhooks")
      .upsert({ event_id: eventId }, { onConflict: "event_id", ignoreDuplicates: true })
      .select("event_id");

    if (claimErr) {
      // Do NOT 200 here: if we cannot record the event, returning success would
      // drop it permanently. Let LS retry.
      console.error("Failed to record webhook idempotency key:", claimErr);
      return new Response(JSON.stringify({ error: "Idempotency store unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!claimed || claimed.length === 0) {
      console.log(`Duplicate webhook ${eventId} (${eventName}) ignored`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
          await runUpdate(
            "subscription_created",
            supabase
              .from("organizations")
              .update({
                ls_customer_id: lsCustomerId,
                ls_subscription_id: lsSubscriptionId,
                subscription_status: status,
              })
              .eq("id", orgId)
              .select("id"),
          );
        } else {
          // [E3] Without org_id we cannot link the subscription to an organization.
          // This almost always means the checkout URL was built without
          // checkout[custom][org_id]. Log loudly with identifiers for triage.
          console.error(
            `subscription_created received WITHOUT custom_data.org_id — ` +
            `cannot link subscription. ls_subscription_id=${lsSubscriptionId} ` +
            `ls_customer_id=${lsCustomerId}`,
          );
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

        await runUpdate(
          "subscription_updated",
          supabase
            .from("organizations")
            .update({ subscription_status: appStatus })
            .eq("ls_subscription_id", lsSubscriptionId)
            .select("id"),
        );
        break;
      }

      // Subscription explicitly cancelled
      case "subscription_cancelled": {
        const lsSubscriptionId = String(data.id);
        await runUpdate(
          "subscription_cancelled",
          supabase
            .from("organizations")
            .update({ subscription_status: "cancelled" })
            .eq("ls_subscription_id", lsSubscriptionId)
            .select("id"),
        );
        break;
      }

      // Subscription resumed after cancellation
      case "subscription_resumed": {
        const lsSubscriptionId = String(data.id);
        await runUpdate(
          "subscription_resumed",
          supabase
            .from("organizations")
            .update({ subscription_status: "active" })
            .eq("ls_subscription_id", lsSubscriptionId)
            .select("id"),
        );
        break;
      }

      // One-time order completed (e.g. package purchase via payment link)
      case "order_created": {
        const lsOrderId = String(data.id);
        const variantId = String(attributes.first_order_item?.variant_id ?? "");

        // If custom_data carries an internal package ID, link it
        const packageId: string = payload.meta?.custom_data?.package_id ?? "";
        if (packageId) {
          await runUpdate(
            "order_created",
            supabase
              .from("packages")
              .update({
                ls_order_id: lsOrderId,
                ls_variant_id: variantId,
                status: "active",
              })
              .eq("id", packageId)
              .select("id"),
          );
        } else {
          console.warn(
            `order_created received WITHOUT custom_data.package_id — order not linked. ls_order_id=${lsOrderId}`,
          );
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
