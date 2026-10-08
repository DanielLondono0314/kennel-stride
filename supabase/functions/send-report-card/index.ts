import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://tailsup.app";

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

// Report cards anteriores a `details` (o creados sin él): métricas clásicas,
// omitiendo las que no aplican (NULL).
const LEGACY_METRICS: [key: string, label: string][] = [
  ["overall_score", "Puntuación general"],
  ["energy_level", "Energía"],
  ["socialization", "Socialización"],
  ["obedience", "Obediencia"],
  ["appetite", "Apetito"],
];

interface Details {
  summary?: { label: string; value: string }[];
  metrics?: { label: string; value: number }[];
  service_label?: string;
  staff_label?: string;
}

function buildEmailBody(
  reportCard: Record<string, any>,
  orgName: string,
  staffName: string | null,
): string {
  const details: Details = reportCard.details && typeof reportCard.details === "object" ? reportCard.details : {};
  const serviceLabel = details.service_label ?? SERVICE_LABELS[reportCard.service_type] ?? reportCard.service_type;
  const [y, m, d] = String(reportCard.session_date).split("-");
  const date = d ? `${d}/${m}/${y}` : reportCard.session_date;

  const metrics = details.metrics?.length
    ? details.metrics
    : LEGACY_METRICS.filter(([key]) => reportCard[key] != null).map(([key, label]) => ({ label, value: reportCard[key] }));

  const lines = [
    `Hola,`,
    ``,
    `Aquí está el reporte de ${reportCard.dog_name} del ${date} (${serviceLabel}).`,
  ];
  if (staffName) lines.push(`${details.staff_label ?? "Encargado"}: ${staffName}`);
  lines.push(``);

  if (details.summary?.length) {
    for (const s of details.summary) lines.push(`${s.label}: ${s.value}`);
    lines.push(``);
  }

  lines.push(`¿Cómo estuvo?`, ...metrics.map((m) => `${m.label}: ${m.value}/5`), ``);
  if (reportCard.notes) lines.push(`Observaciones: ${reportCard.notes}`, ``);
  if (reportCard.highlights) lines.push(`Lo mejor: ${reportCard.highlights}`, ``);
  if (reportCard.areas_to_improve) lines.push(`A tener en cuenta: ${reportCard.areas_to_improve}`, ``);
  if (Array.isArray(reportCard.photos) && reportCard.photos.length) {
    lines.push(`Fotos:`, ...reportCard.photos.map((url: string) => url), ``);
  }
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
      .select("*, dogs(id, name, organization_id, customers(id, first_name, email)), staff_members(first_name, last_name)")
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

    // El perro debe ser de la misma org que el reporte: si no, el email iría al
    // dueño de un perro de otro centro.
    const dog = (reportCard as {
      dogs?: { organization_id?: string; customers?: { email?: string } | null } | null;
    }).dogs;
    if (dog?.organization_id !== reportCard.organization_id) {
      return jsonResponse({ error: "El perro de este reporte no pertenece a la organización" }, 400);
    }

    const { data: org } = await adminClient
      .from("organizations")
      .select("name, subscription_status, trial_ends_at")
      .eq("id", reportCard.organization_id)
      .single();

    const subscriptionActive = !!org && (
      org.subscription_status === "active" ||
      (org.subscription_status === "trialing" && !!org.trial_ends_at && new Date(org.trial_ends_at) > new Date())
    );
    if (!subscriptionActive) {
      return jsonResponse({ error: "La suscripción de la organización no está activa" }, 402);
    }

    const customer = dog?.customers;
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

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@tailsup.app";
    const fromName = Deno.env.get("RESEND_FROM_NAME") ?? org?.name ?? "Tails Up";
    const orgName = org?.name ?? "el equipo";
    const staff = (reportCard as { staff_members?: { first_name?: string; last_name?: string } | null }).staff_members;
    const staffName = staff ? `${staff.first_name ?? ""} ${staff.last_name ?? ""}`.trim() || null : null;

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
        text: buildEmailBody(reportCard, orgName, staffName),
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
