import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { useOrganization } from "@/contexts/OrganizationContext";

export type ContractTemplate = Tables<"contract_templates">;
export type ContractStatus = "generated" | "sent" | "signed" | "void";

/** Columnas que ve el personal (sin token ni imagen de la firma). */
const CONTRACT_COLUMNS =
  "id, organization_id, template_id, customer_id, reservation_id, package_id, title, service_type, body, " +
  "include_signatures, field_values, start_date, end_date, total_value, status, signed_at, signed_via, " +
  "sent_at, sent_to, sign_token_expires_at, signer_name, created_at, updated_at";

export interface ContractRow {
  id: string;
  organization_id: string;
  template_id: string | null;
  customer_id: string;
  reservation_id: string | null;
  package_id: string | null;
  title: string;
  service_type: string | null;
  body: string;
  include_signatures: boolean;
  field_values: Json;
  start_date: string | null;
  end_date: string | null;
  total_value: number | null;
  status: ContractStatus;
  signed_at: string | null;
  signed_via: "paper" | "digital" | null;
  sent_at: string | null;
  sent_to: string[] | null;
  sign_token_expires_at: string | null;
  signer_name: string | null;
  created_at: string;
  updated_at: string;
  customers: { id: string; first_name: string; last_name: string; email: string } | null;
  contract_dogs: { dogs: { id: string; name: string } | null }[];
}

function contractKeys(orgId: string | undefined) {
  return {
    templates: ["contract_templates", orgId] as const,
    all: ["contracts", orgId] as const,
    byDog: (dogId: string) => ["contracts", orgId, "dog", dogId] as const,
  };
}

const SELECT_WITH_RELATIONS =
  `${CONTRACT_COLUMNS}, customers(id, first_name, last_name, email), contract_dogs(dogs(id, name))`;

export function contractDogNames(c: Pick<ContractRow, "contract_dogs">): string[] {
  return c.contract_dogs.map((d) => d.dogs?.name).filter((n): n is string => !!n);
}

export function useContractTemplates() {
  const { organization } = useOrganization();
  return useQuery({
    queryKey: contractKeys(organization?.id).templates,
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_templates")
        .select("*")
        .eq("organization_id", organization!.id)
        .order("name");
      if (error) throw error;
      return data as ContractTemplate[];
    },
  });
}

export function useSaveContractTemplate() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Omit<ContractTemplate, "organization_id">> & { name: string }) => {
      if (!organization) throw new Error("Sin organización activa");
      if (id) {
        const { data, error } = await supabase
          .from("contract_templates")
          .update({ ...input, updated_at: new Date().toISOString() })
          .eq("id", id)
          .eq("organization_id", organization.id)
          .select()
          .single();
        if (error) throw error;
        return data as ContractTemplate;
      }
      const { data, error } = await supabase
        .from("contract_templates")
        .insert({ ...input, organization_id: organization.id })
        .select()
        .single();
      if (error) throw error;
      return data as ContractTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys(organization?.id).templates });
    },
  });
}

export function useDeleteContractTemplate() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contract_templates")
        .delete()
        .eq("id", id)
        .eq("organization_id", organization!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys(organization?.id).templates });
    },
  });
}

export function useContracts() {
  const { organization } = useOrganization();
  return useQuery({
    queryKey: contractKeys(organization?.id).all,
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(SELECT_WITH_RELATIONS)
        .eq("organization_id", organization!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as ContractRow[];
    },
  });
}

/** Contratos anexados a un perro (vía contract_dogs). */
export function useDogContracts(dogId: string | undefined) {
  const { organization } = useOrganization();
  return useQuery({
    queryKey: contractKeys(organization?.id).byDog(dogId ?? ""),
    enabled: !!organization?.id && !!dogId,
    queryFn: async () => {
      // Dos pasos para traer TODOS los perros de cada contrato, no solo este.
      const { data: links, error: linkErr } = await supabase
        .from("contract_dogs")
        .select("contract_id")
        .eq("organization_id", organization!.id)
        .eq("dog_id", dogId!);
      if (linkErr) throw linkErr;
      const ids = (links ?? []).map((l) => l.contract_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("contracts")
        .select(SELECT_WITH_RELATIONS)
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ContractRow[];
    },
  });
}

export interface CreateContractInput {
  template_id: string | null;
  customer_id: string;
  reservation_id: string | null;
  package_id: string | null;
  title: string;
  service_type: string | null;
  body: string;
  include_signatures: boolean;
  field_values: Record<string, string>;
  start_date: string | null;
  end_date: string | null;
  total_value: number | null;
  dog_ids: string[];
}

/** Crea el contrato y lo anexa a cada perro en una sola transacción. */
export function useCreateContract() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: async ({ dog_ids, ...input }: CreateContractInput) => {
      if (!organization) throw new Error("Sin organización activa");
      const { data, error } = await supabase.rpc("create_contract", {
        p_contract: { ...input, organization_id: organization.id } as unknown as Json,
        p_dog_ids: dog_ids,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts", organization?.id] });
    },
  });
}

export function useSetContractStatus() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "signed" | "void" }) => {
      const { error } = await supabase
        .from("contracts")
        .update({ status })
        .eq("id", id)
        .eq("organization_id", organization!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts", organization?.id] });
    },
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contracts")
        .delete()
        .eq("id", id)
        .eq("organization_id", organization!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts", organization?.id] });
    },
  });
}

export interface SendContractResult {
  emailed: boolean;
  signUrl?: string;
  sentTo?: string[];
  error?: string | null;
}

/** Lee el cuerpo JSON de un error de Edge Function (FunctionsHttpError). */
async function functionErrorBody(error: unknown): Promise<Record<string, unknown> | null> {
  const ctx = (error as { context?: Response })?.context;
  if (!ctx || typeof ctx.json !== "function") return null;
  try {
    return await ctx.clone().json();
  } catch {
    return null;
  }
}

/**
 * Envía el contrato al correo del cliente (con copia al centro) con un enlace
 * personal para firmarlo electrónicamente. Si el correo falla, igual devuelve
 * el enlace para compartirlo por otro medio.
 */
export function useSendContract() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: async (contractId: string): Promise<SendContractResult> => {
      const { data, error } = await supabase.functions.invoke("contract-signing", {
        body: { action: "send", contractId },
      });
      if (error) {
        const body = await functionErrorBody(error);
        if (body?.signUrl) {
          return { emailed: false, signUrl: body.signUrl as string, sentTo: body.sentTo as string[], error: body.error as string };
        }
        throw new Error((body?.error as string) ?? "No se pudo enviar el contrato");
      }
      return data as SendContractResult;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts", organization?.id] });
    },
  });
}

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function contractPdfFilename(title: string) {
  const base = title.normalize("NFD").replace(/[\u0300-\u036F]/g, "").replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "-");
  return `${(base || "contrato").slice(0, 80)}.pdf`;
}

/** PDF del contrato (con el registro de firma si se firmó electrónicamente). */
export async function downloadContractPdf(params: { contractId: string } | { token: string }, title: string) {
  const { data, error } = await supabase.functions.invoke("contract-signing", {
    body: { action: "pdf", ...params },
  });
  if (error) {
    const body = await functionErrorBody(error);
    throw new Error((body?.error as string) ?? "No se pudo descargar el PDF");
  }
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: "application/pdf" });
  await downloadBlob(blob, contractPdfFilename(title));
}
