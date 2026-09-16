import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Vista cross-tenant de auth.users para el panel de plataforma (Fase 2).
// auth.users no es accesible por RLS de Postgres normal, así que esto vive
// en una Edge Function con SERVICE_ROLE_KEY en vez de un RPC SECURITY
// DEFINER — el service role nunca se expone al frontend.

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

interface Membership {
  organization_id: string;
  role: string;
  organizations: { name: string; slug: string } | null;
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

  // Verificar que el caller es platform admin activo (no cualquier usuario
  // autenticado puede llamar esta función).
  const { data: platformAdmin } = await adminClient
    .from("platform_admins")
    .select("role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!platformAdmin) {
    return jsonResponse({ error: "No autorizado" }, 403);
  }

  try {
    // Pagina auth.users (tope de 1000 para Fase 2; si la base de usuarios
    // crece más, esto necesita paginación real desde el frontend).
    const users: Array<{ id: string; email: string | null; created_at: string; last_sign_in_at: string | null }> = [];
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      users.push(...data.users.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      })));
      if (data.users.length < 100) break;
    }

    const { data: memberships, error: memErr } = await adminClient
      .from("organization_members")
      .select("user_id, organization_id, role, organizations(name, slug)");

    if (memErr) throw memErr;

    const membershipsByUser = new Map<string, Membership[]>();
    for (const m of (memberships ?? []) as Array<{ user_id: string } & Membership>) {
      const list = membershipsByUser.get(m.user_id) ?? [];
      list.push({ organization_id: m.organization_id, role: m.role, organizations: m.organizations });
      membershipsByUser.set(m.user_id, list);
    }

    const result = users.map((u) => ({
      ...u,
      memberships: membershipsByUser.get(u.id) ?? [],
    }));

    await adminClient.from("platform_admin_audit_log").insert({
      admin_user_id: user.id,
      action: "view_users_list",
      metadata: { count: result.length },
    });

    return jsonResponse({ users: result });
  } catch (err) {
    console.error("platform-admin-users error:", err);
    return jsonResponse({ error: "Error al cargar usuarios" }, 500);
  }
});
