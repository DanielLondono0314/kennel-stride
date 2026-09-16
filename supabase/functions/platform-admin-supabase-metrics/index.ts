import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fase 4: centraliza salud del proyecto Supabase (no reconstruye
// observabilidad propia). SB_MANAGEMENT_API_TOKEN es un Personal Access
// Token org-wide — vive solo como secret de Edge Function, nunca en el
// frontend. Se nombra SB_* (no SUPABASE_*) porque Supabase reserva ese
// prefijo para las variables que inyecta automáticamente.

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://app.kennelops.com";
const PROJECT_REF = "jqnpqmkwcaxqrevfqmue";

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

  const mgmtToken = Deno.env.get("SB_MANAGEMENT_API_TOKEN");
  if (!mgmtToken) {
    return jsonResponse({ error: "Supabase Management API no está configurada (falta secret)" }, 500);
  }

  const mgmtHeaders = { Authorization: `Bearer ${mgmtToken}` };

  try {
    const [projectRes, healthRes] = await Promise.all([
      fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}`, { headers: mgmtHeaders }),
      fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/health?services=auth,db,realtime,rest,storage`, { headers: mgmtHeaders }),
    ]);

    const project = projectRes.ok ? await projectRes.json() : null;
    const health = healthRes.ok ? await healthRes.json() : null;

    if (!project && !health) {
      console.error("Supabase Management API error:", projectRes.status, healthRes.status);
      return jsonResponse({ error: "No se pudo consultar la Management API de Supabase" }, 502);
    }

    return jsonResponse({
      project: project
        ? { id: project.id, name: project.name, region: project.region, status: project.status, database: project.database }
        : null,
      health: health ?? null,
    });
  } catch (err) {
    console.error("platform-admin-supabase-metrics error:", err);
    return jsonResponse({ error: "Error al consultar Supabase Management API" }, 500);
  }
});
