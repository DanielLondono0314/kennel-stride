import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.2";

// ─────────────────────────────────────────────────────────────────────────────
// Geocodifica la dirección de un cliente (Mapbox Geocoding API) para poder
// incluirlo en una ruta de transporte. Se invoca desde la UI justo después de
// guardar el formulario de cliente cuando cambió address/city/state/zip_code.
//
// Nunca bloquea el guardado del cliente: si Mapbox no encuentra la dirección o
// la relevancia es baja, simplemente deja address_lat/lng en NULL — el cliente
// queda fuera de las rutas hasta que la dirección se corrija (create_daily_route
// ya rechaza reservas sin coordenadas).
//
// Variable de entorno requerida: MAPBOX_ACCESS_TOKEN.
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

const MIN_RELEVANCE = 0.7;

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
    const customerId: string = body?.customerId;
    if (!customerId) return jsonResponse({ error: "customerId requerido" }, 400);

    const { data: customer, error: custErr } = await adminClient
      .from("customers")
      .select("id, organization_id, address, city, state, zip_code")
      .eq("id", customerId)
      .single();

    if (custErr || !customer) {
      return jsonResponse({ error: "Cliente no encontrado" }, 404);
    }

    const { data: membership } = await adminClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", customer.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return jsonResponse({ error: "No autorizado para esta organización" }, 403);
    }

    const fullAddress = [customer.address, customer.city, customer.state, customer.zip_code]
      .filter((part) => part && String(part).trim() !== "")
      .join(", ");

    if (!fullAddress) {
      return jsonResponse({ error: "El cliente no tiene dirección para geocodificar" }, 400);
    }

    const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");
    if (!MAPBOX_TOKEN) {
      return jsonResponse({ error: "MAPBOX_ACCESS_TOKEN no configurado. Configura el secret en Supabase." }, 400);
    }

    const geocodeUrl =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(fullAddress)}.json` +
      `?access_token=${MAPBOX_TOKEN}&limit=1`;

    const geocodeRes = await fetch(geocodeUrl);
    if (!geocodeRes.ok) {
      const detail = await geocodeRes.text().catch(() => "");
      console.error(`Mapbox Geocoding failed for customer ${customerId}: HTTP ${geocodeRes.status} ${detail}`);
      return jsonResponse({ error: "No se pudo geocodificar la dirección" }, 502);
    }

    const geocodeData = await geocodeRes.json();
    const feature = geocodeData?.features?.[0];

    if (!feature || (feature.relevance ?? 0) < MIN_RELEVANCE) {
      // No bloquea: solo deja al cliente sin coordenadas hasta que se corrija.
      return jsonResponse({ success: true, geocoded: false });
    }

    const [lng, lat] = feature.center;

    const { error: updateErr } = await adminClient
      .from("customers")
      .update({
        address_lat: lat,
        address_lng: lng,
        address_geocoded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    if (updateErr) {
      console.error("Failed to save geocoded address:", updateErr);
      return jsonResponse({ error: "No se pudo guardar la geocodificación" }, 500);
    }

    return jsonResponse({ success: true, geocoded: true, lat, lng });
  } catch (err) {
    console.error("geocode-customer-address error:", err);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
});
