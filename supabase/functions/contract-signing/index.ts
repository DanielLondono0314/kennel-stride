// Firma electrónica de contratos.
//
// Acciones (POST JSON { action, ... }):
//   send  (personal, con sesión) { contractId }  → genera el enlace personal y lo
//         envía al correo del cliente con copia al correo del centro.
//   view  (pública)  { token }                    → contrato para la página /firmar.
//   sign  (pública)  { token, name, document, signature, accepted }
//         → verifica la cédula, registra la firma y envía el PDF firmado al
//           cliente y al centro.
//   pdf   (pública con token, o personal con contractId) → PDF del contrato.
//
// Desplegar con --no-verify-jwt: las acciones públicas las usa el cliente sin
// cuenta. Las acciones de personal validan la sesión aquí.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as b64encode, decode as b64decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.95.2";
import { buildContractPdf } from "../_shared/contractPdf.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://tailsup.app";
const APP_URL = (Deno.env.get("APP_URL") ?? ALLOWED_ORIGIN).replace(/\/+$/, "");
const LINK_DAYS = 30;
const MAX_FAILED_ATTEMPTS = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "content-disposition",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const DOC_TYPES: Record<string, string> = {
  CC: "C.C.", CE: "C.E.", TI: "T.I.", PA: "Pasaporte", PPT: "PPT", NIT: "NIT",
};

function normalizeDocument(s: string | null | undefined) {
  return (s ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return b64encode(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeFilename(title: string) {
  return (title.normalize("NFD").replace(/[\u0300-\u036F]/g, "").replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "-") || "contrato").slice(0, 80);
}

const CONTRACT_SELECT =
  "*, customers(first_name, last_name, email, id_document, id_document_type), organizations(name, email, phone, timezone), contract_dogs(dogs(name))";

// deno-lint-ignore no-explicit-any
type ContractFull = Record<string, any>;

function customerName(c: ContractFull) {
  return `${c.customers?.first_name ?? ""} ${c.customers?.last_name ?? ""}`.trim();
}

function customerDocument(c: ContractFull) {
  if (!c.customers?.id_document) return null;
  return `${DOC_TYPES[c.customers.id_document_type] ?? ""} ${c.customers.id_document}`.trim();
}

async function pdfFor(c: ContractFull) {
  const digital = c.status === "signed" && c.signed_via === "digital";
  let png: Uint8Array | null = null;
  if (digital && typeof c.signature_image === "string") {
    const m = c.signature_image.match(/^data:image\/png;base64,(.+)$/);
    if (m) png = b64decode(m[1]);
  }
  return buildContractPdf({
    title: c.title,
    body: c.body,
    orgName: c.organizations?.name ?? "",
    includeSignatures: c.include_signatures,
    customerName: customerName(c),
    customerDocument: customerDocument(c),
    digital: digital
      ? {
          signerName: c.signer_name,
          signerDocument: c.signer_document,
          signedAt: c.signed_at,
          ip: c.signer_ip,
          userAgent: c.signer_user_agent,
          sha256: c.body_sha256,
          signaturePng: png,
          timeZone: c.organizations?.timezone,
        }
      : null,
  });
}

async function sendEmail(payload: {
  to: string[];
  cc?: string[];
  replyTo?: string | null;
  fromName: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[];
}): Promise<string | null> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return "RESEND_API_KEY no configurado";
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@tailsup.app";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${payload.fromName} <${fromEmail}>`,
      to: payload.to,
      cc: payload.cc?.length ? payload.cc : undefined,
      reply_to: payload.replyTo || undefined,
      subject: payload.subject,
      html: payload.html,
      attachments: payload.attachments,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`Resend failed: HTTP ${res.status} ${detail}`);
    return "El proveedor de correo rechazó el envío";
  }
  return null;
}

function emailLayout(orgName: string, inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5f3ef;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#1f1f1f">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px 28px 24px;border:1px solid #e7e2da">
    <p style="margin:0 0 18px;font-size:13px;color:#7a746b;text-transform:uppercase;letter-spacing:.06em">${escapeHtml(orgName)}</p>
    ${inner}
  </div></body></html>`;
}

/** Correos destino: cliente en "para", centro en copia (si es distinto). */
function recipients(c: ContractFull) {
  const customer = (c.customers?.email ?? "").trim().toLowerCase();
  const org = (c.organizations?.email ?? "").trim().toLowerCase();
  return { customer, cc: org && org !== customer ? [org] : [] };
}

async function getStaffUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  return user ? userClient : null;
}

/** El personal solo accede a contratos que su RLS le deja ver. */
async function staffContract(req: Request, admin: SupabaseClient, contractId: string) {
  const userClient = await getStaffUser(req);
  if (!userClient) return { error: json({ error: "No autorizado" }, 401) };
  const { data: visible } = await userClient.from("contracts").select("id").eq("id", contractId).maybeSingle();
  if (!visible) return { error: json({ error: "Contrato no encontrado" }, 404) };
  const { data } = await admin.from("contracts").select(CONTRACT_SELECT).eq("id", contractId).single();
  return { contract: data as ContractFull };
}

async function tokenContract(admin: SupabaseClient, token: unknown) {
  if (typeof token !== "string" || token.length < 20) return null;
  const { data } = await admin.from("contracts").select(CONTRACT_SELECT).eq("sign_token", token).maybeSingle();
  return data as ContractFull | null;
}

function linkExpired(c: ContractFull) {
  return !c.sign_token_expires_at || new Date(c.sign_token_expires_at) <= new Date();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // ── Enviar para firma ────────────────────────────────────────────────
    if (action === "send") {
      if (typeof body.contractId !== "string") return json({ error: "contractId requerido" }, 400);
      const r = await staffContract(req, admin, body.contractId);
      if (r.error) return r.error;
      const c = r.contract!;

      if (!["generated", "sent"].includes(c.status)) {
        return json({ error: "Este contrato ya está firmado o anulado" }, 409);
      }
      if (!c.customers?.id_document) {
        return json({ error: "El cliente no tiene cédula registrada. Agrégala en su ficha antes de enviar." }, 400);
      }
      const { customer, cc } = recipients(c);
      if (!customer) return json({ error: "El cliente no tiene un correo registrado" }, 400);

      const token = newToken();
      const expires = new Date(Date.now() + LINK_DAYS * 86400_000).toISOString();
      const { error: upErr } = await admin.from("contracts").update({
        status: "sent",
        sign_token: token,
        sign_token_expires_at: expires,
        sign_failed_attempts: 0,
        sent_at: new Date().toISOString(),
        sent_to: [customer, ...cc],
        body_sha256: await sha256Hex(c.body),
      }).eq("id", c.id);
      if (upErr) {
        console.error("contract send update failed", upErr);
        return json({ error: "No se pudo preparar el contrato" }, 500);
      }

      const signUrl = `${APP_URL}/firmar/${token}`;
      const orgName = c.organizations?.name ?? "Tu centro canino";
      const dogs = (c.contract_dogs ?? []).map((d: ContractFull) => d.dogs?.name).filter(Boolean).join(", ");
      const html = emailLayout(orgName, `
        <h1 style="font-size:20px;margin:0 0 12px">Tienes un contrato para firmar</h1>
        <p style="margin:0 0 12px;line-height:1.5">Hola ${escapeHtml(c.customers?.first_name ?? "")},</p>
        <p style="margin:0 0 12px;line-height:1.5">${escapeHtml(orgName)} te envió el contrato <strong>${escapeHtml(c.title)}</strong>${dogs ? ` para ${escapeHtml(dogs)}` : ""}. Puedes leerlo y firmarlo desde tu celular o computador.</p>
        <p style="margin:22px 0"><a href="${signUrl}" style="background:#2f6f5e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:bold">Revisar y firmar</a></p>
        <p style="margin:0 0 6px;font-size:13px;color:#6b665e;line-height:1.5">Para firmar te pediremos tu número de documento. El enlace es personal y vence en ${LINK_DAYS} días.</p>
        <p style="margin:0;font-size:12px;color:#8a857c;word-break:break-all">${signUrl}</p>`);

      const emailError = await sendEmail({
        to: [customer],
        cc,
        replyTo: c.organizations?.email,
        fromName: orgName,
        subject: `Contrato para firmar: ${c.title}`,
        html,
      });

      return json({ success: !emailError, emailed: !emailError, error: emailError, signUrl, sentTo: [customer, ...cc] }, emailError ? 502 : 200);
    }

    // ── Ver (página pública) ─────────────────────────────────────────────
    if (action === "view") {
      const c = await tokenContract(admin, body.token);
      if (!c) return json({ error: "Enlace no válido" }, 404);
      if (c.status === "void") return json({ error: "Este contrato fue anulado por el centro" }, 410);
      if (c.status === "sent" && linkExpired(c)) {
        return json({ error: "El enlace venció. Pide al centro que te lo envíe de nuevo." }, 410);
      }
      if (c.status === "signed" && c.signed_via !== "digital") {
        return json({ error: "Este contrato ya fue firmado en físico" }, 410);
      }
      const doc = c.customers?.id_document ? normalizeDocument(c.customers.id_document) : "";
      return json({
        title: c.title,
        body: c.body,
        includeSignatures: c.include_signatures,
        status: c.status,
        org: { name: c.organizations?.name, email: c.organizations?.email, phone: c.organizations?.phone },
        customerName: customerName(c),
        documentType: DOC_TYPES[c.customers?.id_document_type] ?? "Documento",
        documentHint: doc ? doc.slice(-3) : null,
        dogs: (c.contract_dogs ?? []).map((d: ContractFull) => d.dogs?.name).filter(Boolean),
        signedAt: c.status === "signed" ? c.signed_at : null,
        signerName: c.status === "signed" ? c.signer_name : null,
      });
    }

    // ── Firmar ───────────────────────────────────────────────────────────
    if (action === "sign") {
      const c = await tokenContract(admin, body.token);
      if (!c || c.status !== "sent" || linkExpired(c)) {
        return json({ error: "Este enlace ya no permite firmar" }, 410);
      }
      const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
      const document = typeof body.document === "string" ? body.document.trim() : "";
      const signature = typeof body.signature === "string" ? body.signature : "";
      if (body.accepted !== true) return json({ error: "Debes aceptar el contrato" }, 400);
      if (name.length < 5 || name.length > 120) return json({ error: "Escribe tu nombre completo" }, 400);
      if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature) || signature.length > 400_000) {
        return json({ error: "La firma no es válida. Dibújala de nuevo." }, 400);
      }

      if (normalizeDocument(document) !== normalizeDocument(c.customers?.id_document)) {
        const attempts = (c.sign_failed_attempts ?? 0) + 1;
        await admin.from("contracts").update({
          sign_failed_attempts: attempts,
          ...(attempts >= MAX_FAILED_ATTEMPTS ? { sign_token_expires_at: new Date().toISOString() } : {}),
        }).eq("id", c.id);
        return json({
          error: attempts >= MAX_FAILED_ATTEMPTS
            ? "Demasiados intentos. Pide al centro que te envíe un enlace nuevo."
            : "El número de documento no coincide con el registrado por el centro.",
        }, 400);
      }

      const hash = await sha256Hex(c.body);
      if (c.body_sha256 && hash !== c.body_sha256) {
        return json({ error: "El contrato cambió después del envío. Pide un enlace nuevo." }, 409);
      }

      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
      const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 300) || null;
      const signedAt = new Date().toISOString();
      const { data: signed, error: signErr } = await admin.from("contracts").update({
        status: "signed",
        signed_via: "digital",
        signed_at: signedAt,
        signer_name: name,
        signer_document: document,
        signer_ip: ip,
        signer_user_agent: userAgent,
        signature_image: signature,
        body_sha256: hash,
      }).eq("id", c.id).eq("status", "sent").select(CONTRACT_SELECT).maybeSingle();
      if (signErr || !signed) {
        console.error("contract sign failed", signErr);
        return json({ error: "No se pudo registrar la firma" }, 500);
      }

      // Copia firmada al cliente y al centro. Si el correo falla la firma
      // igual queda registrada (y se puede descargar desde la página).
      const s = signed as ContractFull;
      const pdf = await pdfFor(s);
      const orgName = s.organizations?.name ?? "Centro canino";
      const { customer, cc } = recipients(s);
      const emailError = customer
        ? await sendEmail({
            to: [customer],
            cc,
            replyTo: s.organizations?.email,
            fromName: orgName,
            subject: `Contrato firmado: ${s.title}`,
            html: emailLayout(orgName, `
              <h1 style="font-size:20px;margin:0 0 12px">Contrato firmado</h1>
              <p style="margin:0 0 12px;line-height:1.5">${escapeHtml(name)} firmó electrónicamente el contrato <strong>${escapeHtml(s.title)}</strong>.</p>
              <p style="margin:0;line-height:1.5">Adjuntamos la copia en PDF con el registro de la firma. Guárdala para tus archivos.</p>`),
            attachments: [{ filename: `${safeFilename(s.title)}.pdf`, content: b64encode(pdf) }],
          })
        : "Sin correo del cliente";

      return json({ success: true, emailed: !emailError });
    }

    // ── PDF ──────────────────────────────────────────────────────────────
    if (action === "pdf") {
      let c: ContractFull | null = null;
      if (typeof body.contractId === "string") {
        const r = await staffContract(req, admin, body.contractId);
        if (r.error) return r.error;
        c = r.contract!;
      } else {
        c = await tokenContract(admin, body.token);
        if (!c || c.status === "void" || (c.status === "signed" && c.signed_via !== "digital")) {
          return json({ error: "Enlace no válido" }, 404);
        }
      }
      const pdf = await pdfFor(c);
      return new Response(pdf, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeFilename(c.title)}.pdf"`,
        },
      });
    }

    return json({ error: "Acción no válida" }, 400);
  } catch (err) {
    console.error("contract-signing error:", err);
    return json({ error: "Error interno del servidor" }, 500);
  }
});
