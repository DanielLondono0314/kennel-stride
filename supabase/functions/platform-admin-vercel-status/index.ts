import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fase 4: centraliza el estado de deploys de Vercel en el panel de
// plataforma en vez de reconstruir observabilidad propia. VERCEL_API_TOKEN,
// VERCEL_PROJECT_ID y VERCEL_TEAM_SLUG viven como secrets de Edge Function,
// nunca en el frontend.

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

  const vercelToken = Deno.env.get("VERCEL_API_TOKEN");
  const projectId = Deno.env.get("VERCEL_PROJECT_ID");
  const teamSlug = Deno.env.get("VERCEL_TEAM_SLUG");

  if (!vercelToken || !projectId) {
    return jsonResponse({ error: "Vercel no está configurado (faltan secrets)" }, 500);
  }

  try {
    const params = new URLSearchParams({ projectId, limit: "10" });
    if (teamSlug) params.set("teamId", teamSlug);

    const res = await fetch(`https://api.vercel.com/v6/deployments?${params.toString()}`, {
      headers: { Authorization: `Bearer ${vercelToken}` },
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Vercel API error:", res.status, detail);
      return jsonResponse({ error: `Vercel API respondió ${res.status}` }, 502);
    }

    const body = await res.json();
    const deployments = (body.deployments ?? []).map((d: Record<string, unknown>) => ({
      uid: d.uid,
      url: d.url,
      state: d.state ?? d.readyState,
      target: d.target ?? null,
      created: d.created ?? d.createdAt,
      commitMessage: (d.meta as Record<string, unknown> | undefined)?.githubCommitMessage ?? null,
      creatorUsername: (d.creator as Record<string, unknown> | undefined)?.username ?? null,
    }));

    return jsonResponse({ deployments });
  } catch (err) {
    console.error("platform-admin-vercel-status error:", err);
    return jsonResponse({ error: "Error al consultar Vercel" }, 500);
  }
});
