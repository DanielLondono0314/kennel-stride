import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://app.kennelops.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  dogs?: { name: string }[];
}

// [E2] Concurrencia acotada para el envío por Resend. Secuencial hace timeout en
// listas grandes; un Promise.all sin límite agota el rate limit de Resend.
const SEND_CONCURRENCY = 5;
// [E2] Resend responde 429 al limitar. Reintentar un número acotado de veces con
// backoff exponencial (honrando Retry-After) antes de contar el fallo.
const MAX_RATE_LIMIT_RETRIES = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface SendOutcome {
  delivered: boolean;
  rateLimited: boolean;
}

/** Envía un email por Resend con reintento/backoff ante 429. Resuelve un
 *  resultado en vez de lanzar, para que el pool siga avanzando. */
async function sendOne(
  apiKey: string,
  fromAddress: string,
  customer: CustomerRow,
  campaign: { name: string; message_template: string },
  unsubscribeHeader: string,
): Promise<SendOutcome> {
  const dogName = customer.dogs?.[0]?.name ?? "tu mascota";
  const personalizedMessage = (campaign.message_template ?? "")
    .replace(/{nombre}/g, customer.first_name)
    .replace(/{perro}/g, dogName)
    .replace(/{email}/g, customer.email);

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [customer.email],
          subject: campaign.name,
          text: personalizedMessage,
          // [E2] Cumplimiento: todo email masivo debe ofrecer baja.
          headers: { "List-Unsubscribe": unsubscribeHeader },
        }),
      });
    } catch (err) {
      console.error(`Resend network error for ${customer.email}:`, err);
      return { delivered: false, rateLimited: false };
    }

    if (res.ok) return { delivered: true, rateLimited: false };

    if (res.status === 429) {
      if (attempt < MAX_RATE_LIMIT_RETRIES) {
        const retryAfter = Number(res.headers.get("Retry-After"));
        const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 2 ** attempt * 500;
        console.warn(`Resend 429 for ${customer.email}; retry ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES} in ${backoffMs}ms`);
        await sleep(backoffMs);
        continue;
      }
      console.error(`Resend 429 for ${customer.email}: retries exhausted`);
      return { delivered: false, rateLimited: true };
    }

    console.error(`Resend send failed for ${customer.email}: HTTP ${res.status}`);
    return { delivered: false, rateLimited: false };
  }
  return { delivered: false, rateLimited: true };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 1. Validar JWT del caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authorization header requerido" }, 401);
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "No autorizado" }, 401);
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const campaignId: string = body?.campaignId;
    if (!campaignId) return jsonResponse({ error: "campaignId requerido" }, 400);

    // 2. Cargar campaña
    const { data: campaign, error: campErr } = await adminClient
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campErr || !campaign) {
      return jsonResponse({ error: "Campaña no encontrada" }, 404);
    }

    // 3. CRÍTICO: verificar que el caller es miembro de la org de la campaña
    const { data: membership } = await adminClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", campaign.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return jsonResponse({ error: "No autorizado para esta organización" }, 403);
    }

    // 4. [E1] Idempotencia: no reenviar una campaña ya enviada
    if (campaign.status === "sent") {
      return jsonResponse({ error: "Esta campaña ya fue enviada", alreadySent: true }, 409);
    }

    // [E1] Lock optimista: pasar a 'sending' solo si sigue en el estado leído.
    // Si otra invocación concurrente ganó la carrera, el update toca 0 filas y
    // abortamos con 409 — esto previene el doble envío por doble-clic o reintento.
    const { data: lockedRows, error: lockErr } = await adminClient
      .from("campaigns")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", campaignId)
      .eq("status", campaign.status)
      .select("id");

    if (lockErr) {
      console.error("Failed to acquire send lock:", lockErr);
      return jsonResponse({ error: "No se pudo bloquear la campaña para envío" }, 500);
    }
    if (!lockedRows || lockedRows.length === 0) {
      return jsonResponse({ error: "La campaña ya se está enviando o fue enviada", alreadySent: true }, 409);
    }

    // Libera el lock devolviendo la campaña a su estado previo (para abortos tempranos).
    const releaseLock = async () => {
      await adminClient
        .from("campaigns")
        .update({ status: campaign.status, updated_at: new Date().toISOString() })
        .eq("id", campaignId);
    };

    const orgId: string = campaign.organization_id;

    // 5. Construir destinatarios según segmento (scoped a la org de la campaña)
    let recipients: CustomerRow[] = [];

    if (campaign.segment_type === "all") {
      const { data } = await adminClient
        .from("customers")
        .select("id, first_name, last_name, email, dogs(name)")
        .eq("organization_id", orgId);
      recipients = (data ?? []) as CustomerRow[];
    } else if (campaign.segment_type === "new") {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await adminClient
        .from("customers")
        .select("id, first_name, last_name, email, dogs(name)")
        .eq("organization_id", orgId)
        .gte("created_at", thirtyDaysAgo);
      recipients = (data ?? []) as CustomerRow[];
    } else if (campaign.segment_type === "inactive") {
      const { data: inactiveIds } = await adminClient
        .rpc("get_inactive_customer_ids", { p_organization_id: orgId, p_days: 30 });
      if (inactiveIds && (inactiveIds as string[]).length > 0) {
        const { data } = await adminClient
          .from("customers")
          .select("id, first_name, last_name, email, dogs(name)")
          .in("id", inactiveIds as string[]);
        recipients = (data ?? []) as CustomerRow[];
      }
    } else if (campaign.segment_type === "vip") {
      // VIP = clientes con >= 5 reservas completadas en el último año
      const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
      const { data: vipData } = await adminClient
        .from("reservations")
        .select("customer_id")
        .eq("organization_id", orgId)
        .eq("status", "completed")
        .gte("start_date", oneYearAgo);

      if (vipData) {
        const countByCustomer: Record<string, number> = {};
        for (const r of vipData) {
          countByCustomer[r.customer_id] = (countByCustomer[r.customer_id] ?? 0) + 1;
        }
        const vipIds = Object.entries(countByCustomer)
          .filter(([, count]) => count >= 5)
          .map(([id]) => id);

        if (vipIds.length > 0) {
          const { data } = await adminClient
            .from("customers")
            .select("id, first_name, last_name, email, dogs(name)")
            .in("id", vipIds);
          recipients = (data ?? []) as CustomerRow[];
        }
      }
    } else {
      await releaseLock();
      return jsonResponse({ error: `Segmento desconocido: ${campaign.segment_type}` }, 400);
    }

    recipients = recipients.filter((c) => c.email);
    if (recipients.length === 0) {
      await releaseLock();
      return jsonResponse({ error: "No hay destinatarios para este segmento" }, 400);
    }

    // 6. Enviar según canal
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (campaign.channel === "sms" || campaign.channel === "whatsapp") {
      await releaseLock();
      return jsonResponse({
        error: `El canal ${campaign.channel} no está configurado. Configura un proveedor de SMS/WhatsApp para usar este canal.`,
      }, 400);
    }
    if (campaign.channel === "email" && !RESEND_API_KEY) {
      await releaseLock();
      return jsonResponse({
        error: "RESEND_API_KEY no configurado. Configura el secret en Supabase para enviar emails.",
      }, 400);
    }

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@kennelops.com";
    const fromName = Deno.env.get("RESEND_FROM_NAME") ?? "KennelOps";
    const fromAddress = `${fromName} <${fromEmail}>`;
    const unsubscribeEmail = Deno.env.get("RESEND_UNSUBSCRIBE_EMAIL") ?? fromEmail;
    const unsubscribeHeader = `<mailto:${unsubscribeEmail}?subject=unsubscribe>`;

    let delivered = 0;
    let failed = 0;
    let rateLimited = 0;

    if (campaign.channel === "email" && RESEND_API_KEY) {
      // [E2] Pool de workers de concurrencia acotada sobre un cursor compartido.
      const list = recipients;
      let cursor = 0;
      const worker = async () => {
        while (true) {
          const index = cursor++;
          if (index >= list.length) return;
          const outcome = await sendOne(RESEND_API_KEY, fromAddress, list[index], campaign, unsubscribeHeader);
          if (outcome.delivered) delivered++;
          else {
            failed++;
            if (outcome.rateLimited) rateLimited++;
          }
        }
      };
      const poolSize = Math.min(SEND_CONCURRENCY, list.length);
      await Promise.all(Array.from({ length: poolSize }, () => worker()));
    }

    const statsSent = delivered + failed;

    await adminClient.from("campaigns").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      stats_sent: statsSent,
      stats_delivered: delivered,
      stats_opened: 0,
      stats_clicked: 0,
      updated_at: new Date().toISOString(),
    }).eq("id", campaignId);

    if (rateLimited > 0) {
      console.warn(`Campaign ${campaignId}: ${rateLimited} destinatarios fallaron por rate limit de Resend`);
    }

    return jsonResponse({ success: true, sent: statsSent, delivered, failed, rateLimited });

  } catch (err) {
    // No devolver detalles internos al cliente
    console.error("send-campaign error:", err);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
});
