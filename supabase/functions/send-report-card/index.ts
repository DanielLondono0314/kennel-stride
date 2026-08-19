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

const SERVICE_LABELS: Record<string, string> = {
  daycare: "Guardería",
  board_and_train: "Internado",
  training_session: "Entrenamiento",
  grooming: "Grooming",
  evaluation: "Evaluación",
};

const METRIC_LABELS: [key: string, label: string][] = [
  ["overall_score", "Puntuación general"],
  ["energy_level", "Energía"],
  ["socialization", "Socialización"],
  ["obedience", "Obediencia"],
  ["appetite", "Apetito"],
];

function buildEmailBody(reportCard: Record<string, any>, orgName: string): string {
  const serviceLabel = SERVICE_LABELS[reportCard.service_type] ?? reportCard.service_type;
  const lines = [
    `Hola,`,
    ``,
    `Aquí está el reporte de ${reportCard.dog_name} del ${reportCard.session_date} (${serviceLabel}).`,
    ``,
    ...METRIC_LABELS.map(([key, label]) => `${label}: ${reportCard[key]}/5`),
    ``,
  ];
  if (reportCard.notes) lines.push(`Observaciones: ${reportCard.notes}`, ``);
  if (reportCard.highlights) lines.push(`Logros destacados: ${reportCard.highlights}`, ``);
  if (reportCard.areas_to_improve) lines.push(`Áreas de mejora: ${reportCard.areas_to_improve}`, ``);
  lines.push(`— ${orgName}`);
  return lines.join("\n");
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
    const reportCardId: string = body?.reportCardId;
    if (!reportCardId) return jsonResponse({ error: "reportCardId requerido" }, 400);

    const { data: reportCard, error: rcErr } = await adminClient
      .from("report_cards")
      .select("*, dogs(id, name, customers(id, first_name, email))")
      .eq("id", reportCardId)
      .single();

    if (rcErr || !reportCard) {
      return jsonResponse({ error: "Report card no encontrado" }, 404);
    }

    const { data: membership } = await adminClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", reportCard.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return jsonResponse({ error: "No autorizado para esta organización" }, 403);
    }

    const { data: org } = await adminClient
      .from("organizations")
      .select("name")
      .eq("id", reportCard.organization_id)
      .single();

    const customer = (reportCard as any).dogs?.customers;
    const recipientEmail: string | undefined = customer?.email;
    if (!recipientEmail) {
      return jsonResponse({ error: "El dueño de este perro no tiene un email registrado" }, 400);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return jsonResponse({
        error: "RESEND_API_KEY no configurado. Configura el secret en Supabase para enviar emails.",
      }, 400);
    }

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@kennelops.com";
    const fromName = Deno.env.get("RESEND_FROM_NAME") ?? org?.name ?? "KennelOps";
    const orgName = org?.name ?? "el equipo";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [recipientEmail],
        subject: `Reporte de ${reportCard.dog_name}`,
        text: buildEmailBody(reportCard, orgName),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`Resend send failed for report card ${reportCardId}: HTTP ${res.status} ${detail}`);
      return jsonResponse({ error: "No se pudo enviar el email. Inténtalo de nuevo." }, 502);
    }

    const { error: updateErr } = await adminClient
      .from("report_cards")
      .update({ is_sent: true, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", reportCardId);

    if (updateErr) {
      console.error("Failed to mark report card as sent:", updateErr);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("send-report-card error:", err);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
});
