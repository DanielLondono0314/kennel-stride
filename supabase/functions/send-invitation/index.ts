import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://app.kennelops.com";
// Base del enlace /join. Por defecto el mismo dominio del frontend (ALLOWED_ORIGIN).
const APP_URL = (Deno.env.get("APP_URL") ?? ALLOWED_ORIGIN).replace(/\/+$/, "");

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildText(orgName: string, roleLabel: string, link: string, expiry: string): string {
  return [
    `Hola,`,
    ``,
    `Te invitaron a unirte a ${orgName} en KennelOps como ${roleLabel}.`,
    ``,
    `Acepta la invitación desde este enlace:`,
    link,
    ``,
    `Crea tu cuenta (o inicia sesión) con este mismo correo electrónico.`,
    `El enlace vence el ${expiry}.`,
    ``,
    `Si no esperabas esta invitación, puedes ignorar este correo.`,
    ``,
    `— ${orgName}`,
  ].join("\n");
}

function buildHtml(orgName: string, roleLabel: string, link: string, expiry: string): string {
  const org = escapeHtml(orgName);
  const role = escapeHtml(roleLabel);
  const href = escapeHtml(link);
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:14px;color:#71717a;">KennelOps</p>
          <h1 style="margin:0 0 16px;font-size:20px;">Te invitaron a unirte a ${org}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.5;">
            Tendrás acceso como <strong>${role}</strong>. Crea tu cuenta o inicia sesión
            <strong>con este mismo correo electrónico</strong> para aceptar la invitación.
          </p>
          <p style="margin:0 0 24px;">
            <a href="${href}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:bold;">
              Aceptar invitación
            </a>
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#71717a;">El enlace vence el ${escapeHtml(expiry)}. Si el botón no funciona, copia esta dirección:</p>
          <p style="margin:0 0 24px;font-size:13px;word-break:break-all;"><a href="${href}" style="color:#2563eb;">${href}</a></p>
          <p style="margin:0;font-size:12px;color:#a1a1aa;">Si no esperabas esta invitación, puedes ignorar este correo.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
    const invitationId: string = body?.invitationId;
    if (!invitationId) return jsonResponse({ error: "invitationId requerido" }, 400);

    const { data: invitation, error: invErr } = await adminClient
      .from("organization_invitations")
      .select("id, organization_id, email, role, token, expires_at, accepted_at, org_roles(name)")
      .eq("id", invitationId)
      .maybeSingle();

    if (invErr || !invitation) {
      return jsonResponse({ error: "Invitación no encontrada" }, 404);
    }

    // Mismo criterio que la RLS de organization_invitations: solo admins de la org.
    const { data: membership } = await adminClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", invitation.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membership?.role !== "admin") {
      return jsonResponse({ error: "Solo un administrador puede enviar invitaciones" }, 403);
    }

    if (invitation.accepted_at) {
      return jsonResponse({ error: "Esta invitación ya fue aceptada" }, 400);
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return jsonResponse({ error: "Esta invitación expiró. Crea una nueva." }, 400);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return jsonResponse({
        error: "RESEND_API_KEY no configurado. Configura el secret en Supabase para enviar emails.",
      }, 400);
    }

    const { data: org } = await adminClient
      .from("organizations")
      .select("name")
      .eq("id", invitation.organization_id)
      .single();

    const orgName = org?.name ?? "tu equipo";
    const roleLabel = (invitation as { org_roles: { name: string } | null }).org_roles?.name ?? invitation.role;
    const link = `${APP_URL}/join?token=${encodeURIComponent(invitation.token)}`;
    const expiry = formatExpiry(invitation.expires_at);

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@kennelops.com";
    const fromName = org?.name ?? Deno.env.get("RESEND_FROM_NAME") ?? "KennelOps";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [invitation.email],
        reply_to: user.email ? [user.email] : undefined,
        subject: `Invitación para unirte a ${orgName}`,
        text: buildText(orgName, roleLabel, link, expiry),
        html: buildHtml(orgName, roleLabel, link, expiry),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`Resend send failed for invitation ${invitationId}: HTTP ${res.status} ${detail}`);
      return jsonResponse({ error: "No se pudo enviar el email. Inténtalo de nuevo." }, 502);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("send-invitation error:", err);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
});
