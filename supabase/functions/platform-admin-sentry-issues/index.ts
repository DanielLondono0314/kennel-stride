import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fase 4: centraliza issues de Sentry en el panel de plataforma.
// SENTRY_API_TOKEN/SENTRY_ORG_SLUG/SENTRY_PROJECT_SLUG viven como secrets
// de Edge Function, nunca en el frontend. El org de Sentry es región US
// (ver DSN: ingest.us.sentry.io), por eso la API base es us.sentry.io.

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://app.kennelops.com";
const SENTRY_API_BASE = "https://us.sentry.io/api/0";

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

  const { data: platformAdmin } = await adminClient
    .from("platform_admins")
    .select("role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!platformAdmin) {
    return jsonResponse({ error: "No autorizado" }, 403);
  }

  const sentryToken = Deno.env.get("SENTRY_API_TOKEN");
  const orgSlug = Deno.env.get("SENTRY_ORG_SLUG");
  const projectSlug = Deno.env.get("SENTRY_PROJECT_SLUG");

  if (!sentryToken || !orgSlug || !projectSlug) {
    return jsonResponse({ error: "Sentry no está configurado (faltan secrets)" }, 500);
  }

  try {
    const params = new URLSearchParams({
      statsPeriod: "14d",
      query: "is:unresolved",
      sort: "freq",
      limit: "10",
    });

    const res = await fetch(
      `${SENTRY_API_BASE}/projects/${orgSlug}/${projectSlug}/issues/?${params.toString()}`,
      { headers: { Authorization: `Bearer ${sentryToken}` } }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("Sentry API error:", res.status, detail);
      return jsonResponse({ error: `Sentry API respondió ${res.status}` }, 502);
    }

    const issues = await res.json();
    const result = (issues as Array<Record<string, unknown>>).map((i) => ({
      id: i.id,
      title: i.title,
      culprit: i.culprit,
      level: i.level,
      count: i.count,
      userCount: i.userCount,
      firstSeen: i.firstSeen,
      lastSeen: i.lastSeen,
      permalink: i.permalink,
    }));

    return jsonResponse({ issues: result });
  } catch (err) {
    console.error("platform-admin-sentry-issues error:", err);
    return jsonResponse({ error: "Error al consultar Sentry" }, 500);
  }
});
