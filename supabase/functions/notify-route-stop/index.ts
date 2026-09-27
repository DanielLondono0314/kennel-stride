import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.2";

// ─────────────────────────────────────────────────────────────────────────────
// Notificación de ruta (pickup/dropoff) por hitos.
//
// El chofer ya marcó "salí hacia aquí" vía el RPC mark_route_stop_departed
// (que solo actualiza estado en Postgres — pg_net no está habilitado en este
// proyecto, así que las llamadas HTTP salientes viven aquí, no en la DB). Esta
// función:
//   1. Calcula el ETA real con Mapbox Directions (origen = ubicación puntual
//      del chofer al tocar el botón, o fallback al centro/organización).
//   2. Resuelve canal (override del cliente > default de la org, forzando SMS
//      si el cliente no dio opt-in de WhatsApp).
//   3. Envía el mensaje por Twilio (SMS con texto libre; WhatsApp con
//      plantilla pre-aprobada — fuera de la ventana de 24h, WhatsApp rechaza
//      texto libre).
//
// Idempotencia: notification_sent_at es un lock optimista — si ya se envió,
// no se reenvía (protege contra doble-tap o reintento de red del cliente).
//
// Variables de entorno requeridas (Supabase Edge Function secrets):
//   MAPBOX_ACCESS_TOKEN
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
//   TWILIO_SMS_FROM
//   TWILIO_WHATSAPP_FROM, TWILIO_WHATSAPP_TEMPLATE_PICKUP_SID,
//   TWILIO_WHATSAPP_TEMPLATE_DROPOFF_SID
// ─────────────────────────────────────────────────────────────────────────────

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

type RouteType = "route_pickup" | "route_dropoff";

function isSubscriptionActive(org: { subscription_status: string; trial_ends_at: string | null }): boolean {
  return org.subscription_status === "active" ||
    (org.subscription_status === "trialing" && !!org.trial_ends_at && new Date(org.trial_ends_at) > new Date());
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
    const stopId: string = body?.stopId;
    const originLat: number | undefined = body?.originLat;
    const originLng: number | undefined = body?.originLng;
    if (!stopId) return jsonResponse({ error: "stopId requerido" }, 400);

    const { data: stop, error: stopErr } = await adminClient
      .from("route_stops")
      .select(`
        id, status, notification_sent_at, lat, lng,
        tasks!inner(id, type, organization_id, assignee_staff_id),
        dogs(name),
        customers(id, first_name, phone, address_lat, address_lng,
                  notification_channel_override, whatsapp_opt_in)
      `)
      .eq("id", stopId)
      .single();

    if (stopErr || !stop) {
      return jsonResponse({ error: "Parada no encontrada" }, 404);
    }

    const task = (stop as any).tasks;
    const orgId: string = task.organization_id;

    const { data: membership } = await adminClient
      .from("organization_members")
      .select("role, org_roles(access_type, permissions)")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return jsonResponse({ error: "No autorizado para esta organización" }, 403);
    }

    // Solo el chofer asignado a la ruta o un rol con permiso 'schedule' (roles
    // personalizados por org) puede disparar la notificación.
    const orgRole = (membership as { org_roles: { access_type: string; permissions: string[] } | null }).org_roles;
    const canSchedule = orgRole?.access_type === "admin" || !!orgRole?.permissions.includes("schedule");
    if (!canSchedule) {
      const { data: myStaff } = await adminClient
        .from("staff_members")
        .select("id")
        .eq("organization_id", orgId)
        .eq("profile_id", user.id);
      const myStaffIds = new Set((myStaff ?? []).map((s: { id: string }) => s.id));
      if (!task.assignee_staff_id || !myStaffIds.has(task.assignee_staff_id)) {
        return jsonResponse({ error: "Solo el chofer asignado puede notificar esta parada" }, 403);
      }
    }

    // Idempotencia: si ya se envió, no reenviar (doble-tap / reintento de red).
    if (stop.notification_sent_at) {
      return jsonResponse({ success: true, alreadySent: true });
    }

    // La salida se marca antes con mark_route_stop_departed; sin eso no hay
    // "en camino" que notificar.
    if (stop.status !== "en_route") {
      return jsonResponse({ error: "Marca la salida hacia esta parada antes de notificar" }, 409);
    }

    const { data: org, error: orgErr } = await adminClient
      .from("organizations")
      .select("name, address, route_notifications_enabled, route_notification_channel, subscription_status, trial_ends_at")
      .eq("id", orgId)
      .single();

    if (orgErr || !org) {
      return jsonResponse({ error: "Organización no encontrada" }, 404);
    }

    if (!isSubscriptionActive(org)) {
      return jsonResponse({ error: "La suscripción de la organización no está activa" }, 402);
    }

    if (!org.route_notifications_enabled) {
      return jsonResponse({ error: "Las notificaciones de ruta están desactivadas para esta organización" }, 400);
    }

    const { data: hasFeature } = await adminClient.rpc("org_has_feature", {
      p_org_id: orgId,
      p_feature: "route_notifications",
    });
    if (hasFeature !== true) {
      return jsonResponse({ error: "Las notificaciones de ruta no están incluidas en tu plan actual" }, 403);
    }

    const customer = (stop as any).customers;
    const dogName: string = (stop as any).dogs?.name ?? "tu perro";

    if (!customer?.phone) {
      return jsonResponse({ error: "El cliente no tiene un teléfono registrado" }, 400);
    }

    const destLat = customer.address_lat ?? stop.lat;
    const destLng = customer.address_lng ?? stop.lng;
    if (destLat == null || destLng == null) {
      return jsonResponse({ error: "La parada no tiene coordenadas para calcular el ETA" }, 400);
    }

    // Origen: ubicación puntual del chofer al tocar "Salí hacia aquí" (un solo
    // punto, no tracking continuo). Si no la mandó (permiso denegado), cae al
    // domicilio de la organización si está geocodificable por Mapbox on-the-fly
    // vía la propia Directions API con dirección de texto — más simple: si no
    // hay origen, no se puede calcular ETA por distancia real y se aborta con
    // un mensaje claro para que la UI reintente pidiendo el permiso.
    if (originLat == null || originLng == null) {
      return jsonResponse({
        error: "No se pudo obtener tu ubicación para calcular el ETA. Activa el GPS e inténtalo de nuevo.",
      }, 400);
    }

    const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");
    if (!MAPBOX_TOKEN) {
      return jsonResponse({ error: "MAPBOX_ACCESS_TOKEN no configurado. Configura el secret en Supabase." }, 400);
    }

    const directionsUrl =
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${originLng},${originLat};${destLng},${destLat}` +
      `?access_token=${MAPBOX_TOKEN}`;

    const directionsRes = await fetch(directionsUrl);
    if (!directionsRes.ok) {
      const detail = await directionsRes.text().catch(() => "");
      console.error(`Mapbox Directions failed for stop ${stopId}: HTTP ${directionsRes.status} ${detail}`);
      return jsonResponse({ error: "No se pudo calcular el ETA con Mapbox" }, 502);
    }
    const directionsData = await directionsRes.json();
    const durationSeconds = directionsData?.routes?.[0]?.duration;
    if (typeof durationSeconds !== "number") {
      return jsonResponse({ error: "Mapbox no devolvió una ruta válida a esta dirección" }, 502);
    }
    const etaMinutes = Math.max(1, Math.round(durationSeconds / 60));

    // Canal: override del cliente > default de la org, forzando SMS si el
    // cliente no dio opt-in de WhatsApp (evita plantillas rechazadas por Meta).
    let channel: "sms" | "whatsapp" = (customer.notification_channel_override ?? org.route_notification_channel);
    if (channel === "whatsapp" && !customer.whatsapp_opt_in) channel = "sms";

    const routeType: RouteType = task.type;
    const isPickup = routeType === "route_pickup";

    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!TWILIO_SID || !TWILIO_TOKEN) {
      return jsonResponse({ error: "Twilio no configurado. Configura los secrets en Supabase." }, 400);
    }

    const basicAuth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
    let twilioBody: URLSearchParams;

    if (channel === "whatsapp") {
      const contentSid = isPickup
        ? Deno.env.get("TWILIO_WHATSAPP_TEMPLATE_PICKUP_SID")
        : Deno.env.get("TWILIO_WHATSAPP_TEMPLATE_DROPOFF_SID");
      const whatsappFrom = Deno.env.get("TWILIO_WHATSAPP_FROM");
      if (!contentSid || !whatsappFrom) {
        return jsonResponse({ error: `Plantilla de WhatsApp no configurada para ${routeType}` }, 400);
      }
      twilioBody = new URLSearchParams({
        To: `whatsapp:${customer.phone}`,
        From: `whatsapp:${whatsappFrom}`,
        ContentSid: contentSid,
        // Orden de variables debe calzar con la plantilla aprobada en Twilio
        // Content Template Builder, ej: "Tu perro {{1}} va a ser recogido en
        // ~{{2}} min."
        ContentVariables: JSON.stringify({ "1": dogName, "2": String(etaMinutes) }),
      });
    } else {
      const smsFrom = Deno.env.get("TWILIO_SMS_FROM");
      if (!smsFrom) {
        return jsonResponse({ error: "TWILIO_SMS_FROM no configurado" }, 400);
      }
      const verb = isPickup ? "va a ser recogido" : "va a ser entregado";
      twilioBody = new URLSearchParams({
        To: customer.phone,
        From: smsFrom,
        Body: `${org.name}: ${dogName} ${verb} en ~${etaMinutes} min.`,
      });
    }

    // Reclamo atómico: solo una invocación concurrente pasa de aquí. Antes se
    // comprobaba notification_sent_at y se enviaba después, así que un doble
    // tap mandaba dos SMS. Si Twilio falla, se libera el reclamo para reintentar.
    const claimedAt = new Date().toISOString();
    const { data: claimed } = await adminClient
      .from("route_stops")
      .update({ notification_sent_at: claimedAt })
      .eq("id", stopId)
      .is("notification_sent_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) {
      return jsonResponse({ success: true, alreadySent: true });
    }

    const releaseClaim = () =>
      adminClient
        .from("route_stops")
        .update({ notification_sent_at: null })
        .eq("id", stopId)
        .eq("notification_sent_at", claimedAt);

    let twilioRes: Response;
    try {
      twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: twilioBody,
        }
      );
    } catch (err) {
      console.error(`Twilio network error for stop ${stopId}:`, err);
      await releaseClaim();
      return jsonResponse({ error: "No se pudo enviar la notificación. Inténtalo de nuevo." }, 502);
    }

    if (!twilioRes.ok) {
      const detail = await twilioRes.text().catch(() => "");
      console.error(`Twilio send failed for stop ${stopId}: HTTP ${twilioRes.status} ${detail}`);
      await adminClient
        .from("route_stops")
        .update({
          eta_minutes: etaMinutes,
          eta_calculated_at: new Date().toISOString(),
          notification_error: detail.slice(0, 500),
          notification_sent_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", stopId)
        .eq("notification_sent_at", claimedAt);
      return jsonResponse({ error: "No se pudo enviar la notificación. Inténtalo de nuevo." }, 502);
    }

    await adminClient
      .from("route_stops")
      .update({
        status: "notified",
        eta_minutes: etaMinutes,
        eta_calculated_at: new Date().toISOString(),
        notification_channel: channel,
        notification_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stopId);

    return jsonResponse({ success: true, etaMinutes, channel });
  } catch (err) {
    console.error("notify-route-stop error:", err);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
});
