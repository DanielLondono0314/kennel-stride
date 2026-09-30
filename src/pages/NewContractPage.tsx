import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, CalendarDays, Dog, FileSignature, Loader2, CalendarCheck,
  Printer, Search, User, AlertTriangle, RotateCcw, Send, IdCard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { ContractDocument } from "@/components/contracts/ContractDocument";
import { SendContractDialog } from "@/components/contracts/SendContractDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ID_DOCUMENT_TYPES, idDocumentShort, isDuplicateIdDocumentError, type IdDocumentType } from "@/lib/idDocument";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrgBasePath, useOrgNavigate } from "@/hooks/useOrgNavigate";
import { usePermission } from "@/hooks/usePermission";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { useContractTemplates, useCreateContract } from "@/hooks/queries/useContracts";
import { ilikeAny } from "@/lib/supabaseQuery";
import { cn } from "@/lib/utils";
import {
  buildContractHtml, defaultSignatures, dogVariables, describeDuration, extractCustomVariables, formatContractValue,
  formatLongDate, humanizeKey, isOvernightService, numberToSpanishWords, printContract,
  renderTemplate, usedVariables,
} from "@/lib/contracts";
import { todayLocal } from "@/lib/age";

const STEPS = ["Plantilla", "Cliente", "Detalles", "Imprimir"] as const;

interface CustomerFull {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string | null;
  city: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  id_document: string | null;
  id_document_type: string;
}

interface DogLite {
  id: string;
  name: string;
  breed: string;
  gender: string;
  color: string | null;
  birth_date: string | null;
  microchip_number: string | null;
}

interface ReservationLite {
  id: string;
  dog_id: string;
  service_type: string;
  service_name: string;
  start_date: string;
  end_date: string;
  total_price: number;
  status: string;
}

interface PlanLite {
  id: string;
  dog_id: string;
  service_type: string;
  service_label: string;
  billing: "duration" | "quantity";
  quantity_total: number | null;
  unit_label: string | null;
  includes: string[];
  price: number;
  start_date: string;
  end_date: string | null;
}

type Source = { kind: "reservation"; id: string } | { kind: "plan"; id: string } | null;

interface DetailsForm {
  servicio: string;
  servicios_incluidos: string;
  sesiones: string;
  forma_pago: string;
  observaciones: string;
  start_date: string;
  end_date: string;
  duracion: string;
  total_value: string;
  cliente_telefono: string;
  cliente_email: string;
  cliente_direccion: string;
  cliente_ciudad: string;
}

const EMPTY_FORM: DetailsForm = {
  servicio: "", servicios_incluidos: "", sesiones: "", forma_pago: "", observaciones: "",
  start_date: "", end_date: "", duracion: "", total_value: "",
  cliente_telefono: "", cliente_email: "", cliente_direccion: "", cliente_ciudad: "",
};

function toDateInput(iso: string | null | undefined) {
  return iso ? iso.slice(0, 10) : "";
}

function shortDate(iso: string) {
  return format(parseISO(iso), "d MMM yyyy", { locale: es });
}

export default function NewContractPage() {
  const navigate = useOrgNavigate();
  const basePath = useOrgBasePath();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const { organization } = useOrganization();
  const { labels: serviceLabels } = useServiceTypes();
  const canSchedule = usePermission("schedule");
  const canBill = usePermission("billing");
  const canUse = canSchedule || canBill;

  const templatesQuery = useContractTemplates();
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const createContract = useCreateContract();

  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState<string | null>(params.get("template"));
  const [customerId, setCustomerId] = useState<string | null>(params.get("customer"));
  const [dogIds, setDogIds] = useState<string[]>(params.get("dog") ? [params.get("dog")!] : []);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<Source>(null);
  const [form, setForm] = useState<DetailsForm>(EMPTY_FORM);
  const [durationTouched, setDurationTouched] = useState(false);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [docType, setDocType] = useState<IdDocumentType>("CC");
  const [docNumber, setDocNumber] = useState("");
  const [savingDoc, setSavingDoc] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  // Con plantilla preseleccionada se salta al paso de cliente (aunque el
  // cliente venga en la URL: ahí se confirman los perros y la cédula).
  useEffect(() => {
    if (params.get("template")) setStep(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const template = templates.find((t) => t.id === templateId) ?? null;
  const used = useMemo(() => usedVariables(template?.body ?? ""), [template]);
  const customVars = useMemo(() => extractCustomVariables(template?.body ?? ""), [template]);

  // ── Datos ─────────────────────────────────────────────────────────────
  const searchQuery = useQuery({
    queryKey: ["contract-customer-search", organization?.id, search],
    enabled: !!organization?.id && step === 1 && !customerId,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("customers")
        .select("id, first_name, last_name, phone, email, dogs(name)")
        .eq("organization_id", organization!.id)
        .eq("is_active", true)
        .order("first_name")
        .limit(20);
      if (search.trim()) q = q.or(ilikeAny(["first_name", "last_name", "email", "phone"], search));
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; first_name: string; last_name: string; phone: string; email: string; dogs: { name: string }[] }>;
    },
  });

  const customerQuery = useQuery({
    queryKey: ["contract-customer", organization?.id, customerId],
    enabled: !!organization?.id && !!customerId,
    queryFn: async () => {
      const orgId = organization!.id;
      const [c, d, r, p] = await Promise.all([
        supabase.from("customers")
          .select("id, first_name, last_name, email, phone, address, city, emergency_contact_name, emergency_contact_phone, id_document, id_document_type")
          .eq("organization_id", orgId).eq("id", customerId!).single(),
        supabase.from("dogs")
          .select("id, name, breed, gender, color, birth_date, microchip_number")
          .eq("organization_id", orgId).eq("customer_id", customerId!).eq("is_active", true).order("name"),
        supabase.from("reservations")
          .select("id, dog_id, service_type, service_name, start_date, end_date, total_price, status")
          .eq("organization_id", orgId).eq("customer_id", customerId!)
          .not("status", "in", "(cancelled,rejected)")
          .order("start_date", { ascending: false }).limit(8),
        supabase.from("dog_plans")
          .select("id, dog_id, service_type, service_label, billing, quantity_total, unit_label, includes, price, start_date, end_date")
          .eq("organization_id", orgId).eq("customer_id", customerId!).neq("status", "cancelled")
          .order("start_date", { ascending: false }).limit(8),
      ]);
      if (c.error) throw c.error;
      return {
        customer: c.data as CustomerFull,
        dogs: (d.data ?? []) as DogLite[],
        reservations: (r.data ?? []) as ReservationLite[],
        plans: (p.data ?? []) as PlanLite[],
      };
    },
  });

  const customer = customerQuery.data?.customer ?? null;
  const dogs = useMemo(() => customerQuery.data?.dogs ?? [], [customerQuery.data]);
  const selectedDogs = useMemo(() => dogs.filter((d) => dogIds.includes(d.id)), [dogs, dogIds]);
  const toggleDog = (id: string) =>
    setDogIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Reservas y planes del cliente, primero los del mismo servicio que la plantilla.
  const sources = useMemo(() => {
    const data = customerQuery.data;
    if (!data) return [];
    const list = [
      ...data.reservations
        .filter((r) => dogIds.length === 0 || dogIds.includes(r.dog_id))
        .map((r) => ({ kind: "reservation" as const, id: r.id, serviceType: r.service_type, item: r })),
      ...data.plans
        .filter((p) => dogIds.length === 0 || dogIds.includes(p.dog_id))
        .map((p) => ({ kind: "plan" as const, id: p.id, serviceType: p.service_type, item: p })),
    ];
    const target = template?.service_type;
    return target ? [...list].sort((a, b) => Number(b.serviceType === target) - Number(a.serviceType === target)) : list;
  }, [customerQuery.data, dogIds, template?.service_type]);

  // Al cargar el cliente: perro por defecto y datos de contacto al formulario.
  // Solo una vez por cliente, para que un refetch no pise lo que se editó.
  const prefilledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!customer || prefilledFor.current === customer.id) return;
    prefilledFor.current = customer.id;
    // Un solo perro: preseleccionado. Si llegó ?dog=, se respeta si es de este cliente.
    setDogIds((prev) => {
      const valid = prev.filter((id) => dogs.some((d) => d.id === id));
      return valid.length ? valid : dogs.length === 1 ? [dogs[0].id] : [];
    });
    setDocType((customer.id_document_type as IdDocumentType) || "CC");
    setDocNumber("");
    setForm((f) => ({
      ...f,
      cliente_telefono: customer.phone ?? "",
      cliente_email: customer.email ?? "",
      cliente_direccion: customer.address ?? "",
      cliente_ciudad: customer.city ?? "",
    }));
  }, [customer, dogs]);

  const applySource = (s: (typeof sources)[number]) => {
    setSource({ kind: s.kind, id: s.id });
    setDurationTouched(false);
    if (s.kind === "reservation") {
      const r = s.item as ReservationLite;
      if (r.dog_id) setDogIds((prev) => (prev.includes(r.dog_id) ? prev : [...prev, r.dog_id]));
      setForm((f) => ({
        ...f,
        servicio: r.service_name || serviceLabels[r.service_type] || f.servicio,
        start_date: toDateInput(r.start_date),
        end_date: toDateInput(r.end_date),
        total_value: r.total_price ? String(r.total_price) : f.total_value,
      }));
    } else {
      const p = s.item as PlanLite;
      setDogIds((prev) => (prev.includes(p.dog_id) ? prev : [...prev, p.dog_id]));
      setForm((f) => ({
        ...f,
        servicio: p.service_label,
        servicios_incluidos: p.includes.length ? p.includes.join(", ") : f.servicios_incluidos,
        sesiones: p.quantity_total ? `${p.quantity_total} ${p.unit_label ?? ""}`.trim() : f.sesiones,
        start_date: toDateInput(p.start_date),
        end_date: toDateInput(p.end_date),
        total_value: p.price ? String(p.price) : f.total_value,
      }));
    }
  };

  // Al entrar a Detalles por primera vez: autollenar con la mejor coincidencia.
  useEffect(() => {
    if (step !== 2 || source || !template) return;
    const best = sources.find((s) => s.serviceType === template.service_type) ?? null;
    if (best) applySource(best);
    else
      setForm((f) => ({
        ...f,
        servicio: f.servicio || (template.service_type ? serviceLabels[template.service_type] ?? template.name : template.name),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, template?.id, sources.length]);

  const sourceServiceType = source ? sources.find((s) => s.id === source.id)?.serviceType ?? null : null;
  const overnight = isOvernightService(template?.service_type ?? sourceServiceType);
  const autoDuration = describeDuration(form.start_date, form.end_date, overnight);
  const duration = durationTouched ? form.duracion : autoDuration;
  const totalNumber = form.total_value.trim() ? Number(form.total_value) : null;

  const values = useMemo<Record<string, string>>(() => {
    const v: Record<string, string> = {
      negocio_nombre: organization?.name ?? "",
      negocio_direccion: organization?.address ?? "",
      negocio_ciudad: organization?.city ?? "",
      negocio_telefono: organization?.phone ?? "",
      negocio_email: organization?.email ?? "",
      cliente_nombre: customer ? `${customer.first_name} ${customer.last_name}`.trim() : "",
      cliente_tipo_documento: customer?.id_document ? idDocumentShort(customer.id_document_type) : "",
      cliente_documento: customer?.id_document ?? "",
      cliente_telefono: form.cliente_telefono,
      cliente_email: form.cliente_email,
      cliente_direccion: form.cliente_direccion,
      cliente_ciudad: form.cliente_ciudad,
      contacto_emergencia: customer?.emergency_contact_name
        ? [customer.emergency_contact_name, customer.emergency_contact_phone].filter(Boolean).join(" · ")
        : "",
      ...dogVariables(selectedDogs),
      servicio: form.servicio,
      servicios_incluidos: form.servicios_incluidos,
      sesiones: form.sesiones,
      valor_total: formatContractValue(totalNumber),
      valor_letras: totalNumber != null && Number.isFinite(totalNumber) ? numberToSpanishWords(totalNumber) : "",
      forma_pago: form.forma_pago,
      observaciones: form.observaciones,
      fecha_inicio: formatLongDate(form.start_date),
      fecha_fin: formatLongDate(form.end_date),
      duracion: duration,
      fecha_hoy: formatLongDate(todayLocal()),
    };
    for (const k of customVars) v[k] = custom[k] ?? "";
    return v;
  }, [organization, customer, selectedDogs, form, totalNumber, duration, customVars, custom]);

  const renderedBody = useMemo(() => renderTemplate(template?.body ?? "", values), [template, values]);
  const html = useMemo(
    () => buildContractHtml(renderedBody, template?.include_signatures ? defaultSignatures(values) : null),
    [renderedBody, template?.include_signatures, values]
  );
  const blanks = [...used].filter((k) => !values[k]?.trim());

  useEffect(() => {
    if (template && customer) setTitle(`${template.name} — ${customer.first_name} ${customer.last_name}`.trim());
  }, [template, customer]);

  const set = (key: keyof DetailsForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const datesInvalid = !!form.start_date && !!form.end_date && form.end_date < form.start_date;
  const canNext =
    (step === 0 && !!template) ||
    (step === 1 && !!customer?.id_document && (dogs.length === 0 || dogIds.length > 0)) ||
    (step === 2 && !datesInvalid);

  // La cédula es obligatoria en el contrato: si falta, se captura aquí y se
  // guarda en la ficha del cliente.
  const saveCustomerDocument = async () => {
    if (!customer) return;
    const number = docNumber.trim();
    if (!/^[0-9A-Za-z .-]{3,30}$/.test(number)) {
      toast.error("Escribe un número de documento válido");
      return;
    }
    setSavingDoc(true);
    const { error } = await supabase
      .from("customers")
      .update({ id_document: number, id_document_type: docType })
      .eq("id", customer.id)
      .eq("organization_id", organization!.id);
    setSavingDoc(false);
    if (error) {
      toast.error(isDuplicateIdDocumentError(error) ? "Ya existe otro cliente con ese documento" : "No se pudo guardar el documento");
      return;
    }
    toast.success("Documento guardado en la ficha del cliente");
    queryClient.invalidateQueries({ queryKey: ["customers", organization?.id] });
    await customerQuery.refetch();
  };

  const save = async (then: "print" | "send" | null) => {
    if (!template || !customer) return;
    if (!title.trim()) { toast.error("Ponle un título al contrato"); return; }
    try {
      const created = await createContract.mutateAsync({
        template_id: template.id,
        customer_id: customer.id,
        dog_ids: selectedDogs.map((d) => d.id),
        reservation_id: source?.kind === "reservation" ? source.id : null,
        dog_plan_id: source?.kind === "plan" ? source.id : null,
        title: title.trim().slice(0, 160),
        service_type: template.service_type ?? sourceServiceType,
        body: renderedBody,
        include_signatures: template.include_signatures,
        field_values: values,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        total_value: totalNumber != null && Number.isFinite(totalNumber) ? totalNumber : null,
      });
      setSavedId(created);
      toast.success(selectedDogs.length ? `Contrato guardado y anexado a ${selectedDogs.map((d) => d.name).join(", ")}` : "Contrato guardado");
      if (then === "print") printContract(title.trim(), html);
      if (then === "send") setSendOpen(true);
    } catch {
      toast.error("No se pudo guardar el contrato", { description: "Revisa tu conexión e inténtalo de nuevo." });
    }
  };

  const restart = () => {
    setStep(0);
    setTemplateId(null);
    setCustomerId(null);
    setDogIds([]);
    setSource(null);
    setForm(EMPTY_FORM);
    setCustom({});
    setDurationTouched(false);
    setSavedId(null);
    setSearch("");
    prefilledFor.current = null;
  };

  if (!canUse) {
    return <EmptyState icon={FileSignature} title="Sin acceso a contratos" description="Tu rol necesita el permiso de agendar o de cobrar." />;
  }

  const showField = (key: string) => used.has(key);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/contracts")} aria-label="Volver a contratos">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Generar contrato</h1>
          <p className="text-muted-foreground">Elige la plantilla y el cliente; el sistema llena el resto.</p>
        </div>
      </div>

      {/* Stepper */}
      <ol className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Pasos">
        {STEPS.map((label, i) => {
          const done = i < step || (i === 3 && !!savedId);
          const current = i === step;
          const reachable = i < step && !savedId;
          return (
            <li key={label} className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && setStep(i)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors",
                  current && "bg-primary text-primary-foreground",
                  !current && done && "bg-primary/10 text-primary hover:bg-primary/15",
                  !current && !done && "text-muted-foreground",
                  !reachable && "cursor-default"
                )}
              >
                <span className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold",
                  current ? "bg-primary-foreground/20" : done ? "bg-primary/20" : "bg-muted"
                )}>
                  {done && !current ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {label}
              </button>
              {i < STEPS.length - 1 && <span className="h-px w-6 bg-border" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      {/* ── Paso 1: plantilla ── */}
      {step === 0 && (
        templates.length === 0 && !templatesQuery.isLoading ? (
          <Card>
            <EmptyState
              icon={FileSignature}
              title="No hay plantillas"
              description="Un administrador debe crear primero las plantillas de contrato."
              action={<Button variant="outline" onClick={() => navigate("/contracts?tab=templates")}>Ir a plantillas</Button>}
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Plantilla">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={templateId === t.id}
                onClick={() => setTemplateId(t.id)}
                onDoubleClick={() => { setTemplateId(t.id); setStep(1); }}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  templateId === t.id && "border-primary bg-primary/5 ring-1 ring-primary"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{t.name}</span>
                  {templateId === t.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                </div>
                <span className="text-sm text-muted-foreground">
                  {t.service_type ? serviceLabels[t.service_type] ?? t.service_type : "Cualquier servicio"}
                </span>
              </button>
            ))}
          </div>
        )
      )}

      {/* ── Paso 2: cliente y perro ── */}
      {step === 1 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="font-semibold flex items-center gap-2"><User className="h-4 w-4" /> ¿Para qué cliente es?</h2>
              {customer ? (
                <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 p-3">
                  <div>
                    <p className="font-medium">{customer.first_name} {customer.last_name}</p>
                    <p className="text-sm text-muted-foreground">{[customer.phone, customer.email].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setCustomerId(null); setDogIds([]); setSource(null); }}>
                    Cambiar
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      autoFocus
                      placeholder="Buscar por nombre, teléfono o email..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y rounded-lg border">
                    {searchQuery.isLoading || customerQuery.isFetching ? (
                      <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : (searchQuery.data ?? []).length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">No se encontraron clientes.</p>
                    ) : (
                      searchQuery.data!.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setCustomerId(c.id); setDogIds([]); setSource(null); }}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:bg-muted"
                        >
                          <span>
                            <span className="block font-medium">{c.first_name} {c.last_name}</span>
                            <span className="block text-xs text-muted-foreground">{c.phone || c.email}</span>
                          </span>
                          {c.dogs?.length > 0 && (
                            <span className="text-xs text-muted-foreground truncate max-w-[40%]">
                              {c.dogs.map((d) => d.name).join(", ")}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {customer && (
            <div className="space-y-6">
              {!customer.id_document && (
                <Card className="border-warning/50">
                  <CardContent className="pt-6 space-y-4">
                    <h2 className="font-semibold flex items-center gap-2"><IdCard className="h-4 w-4" /> Falta el documento del cliente</h2>
                    <p className="text-sm text-muted-foreground">
                      Es obligatorio para el contrato y para verificar la firma digital. Se guardará en la ficha del cliente.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] sm:items-end">
                      <div className="space-y-1.5">
                        <Label htmlFor="c-doc-type">Tipo</Label>
                        <Select value={docType} onValueChange={(v) => setDocType(v as IdDocumentType)}>
                          <SelectTrigger id="c-doc-type"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ID_DOCUMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="c-doc-number">Número</Label>
                        <Input
                          id="c-doc-number"
                          value={docNumber}
                          onChange={(e) => setDocNumber(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveCustomerDocument()}
                          placeholder="1.020.304.050"
                          autoComplete="off"
                        />
                      </div>
                      <Button onClick={saveCustomerDocument} disabled={savingDoc || !docNumber.trim()}>
                        {savingDoc && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Guardar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <h2 className="font-semibold flex items-center gap-2"><Dog className="h-4 w-4" /> ¿Para qué perros?</h2>
                    <p className="text-sm text-muted-foreground">El contrato quedará anexado al perfil de cada perro que marques.</p>
                  </div>
                  {dogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Este cliente no tiene perros activos; el contrato saldrá sin datos de mascota.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Perros">
                      {dogs.map((d) => {
                        const checked = dogIds.includes(d.id);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            role="checkbox"
                            aria-checked={checked}
                            onClick={() => toggleDog(d.id)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border p-3 text-left hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              checked && "border-primary bg-primary/5 ring-1 ring-primary"
                            )}
                          >
                            <span className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary",
                              checked && "bg-primary text-primary-foreground"
                            )}>
                              {checked && <Check className="h-3 w-3" />}
                            </span>
                            <span>
                              <span className="block font-medium">{d.name}</span>
                              <span className="block text-xs text-muted-foreground">{d.breed}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {dogs.length > 1 && (
                    <div className="flex gap-2 text-sm">
                      <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setDogIds(dogs.map((d) => d.id))}>Todos</button>
                      <span className="text-muted-foreground">·</span>
                      <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setDogIds([])}>Ninguno</button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── Paso 3: detalles ── */}
      {step === 2 && template && customer && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            {sources.length > 0 && (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h2 className="font-semibold">Llenar con una reserva o plan</h2>
                  <p className="text-sm text-muted-foreground">Toma fechas, valor y servicio de lo que ya está registrado.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {sources.map((s) => {
                      const active = source?.id === s.id;
                      const match = !!template.service_type && s.serviceType === template.service_type;
                      const isRes = s.kind === "reservation";
                      const r = s.item as ReservationLite;
                      const p = s.item as PlanLite;
                      return (
                        <button
                          key={`${s.kind}-${s.id}`}
                          type="button"
                          onClick={() => applySource(s)}
                          aria-pressed={active}
                          className={cn(
                            "rounded-lg border p-3 text-left text-sm hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active && "border-primary bg-primary/5 ring-1 ring-primary"
                          )}
                        >
                          <span className="flex items-center gap-1.5 font-medium">
                            {isRes ? <CalendarDays className="h-3.5 w-3.5" /> : <CalendarCheck className="h-3.5 w-3.5" />}
                            {isRes ? r.service_name || serviceLabels[r.service_type] : `Plan: ${p.service_label}`}
                            {match && <Badge variant="secondary" className="ml-auto text-[10px]">Coincide</Badge>}
                          </span>
                          <span className="block text-xs text-muted-foreground mt-0.5">
                            {isRes
                              ? `${shortDate(r.start_date)} – ${shortDate(r.end_date)} · ${formatContractValue(r.total_price)}`
                              : `${p.quantity_total ? `${p.quantity_total} ${p.unit_label ?? ""} · ` : ""}${formatContractValue(p.price)} · ${shortDate(p.start_date)}${p.end_date ? ` – ${shortDate(p.end_date)}` : ""}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="font-semibold">Servicio, fechas y valor</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="c-servicio">Servicio / plan</Label>
                    <Input id="c-servicio" value={form.servicio} onChange={set("servicio")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-start">Fecha de inicio</Label>
                    <Input id="c-start" type="date" value={form.start_date} onChange={set("start_date")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-end">Fecha de fin</Label>
                    <Input id="c-end" type="date" value={form.end_date} min={form.start_date || undefined} onChange={set("end_date")} aria-invalid={datesInvalid} />
                    {datesInvalid && <p className="text-xs text-destructive">Debe ser igual o posterior al inicio.</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-dur">Duración</Label>
                    <div className="flex gap-2">
                      <Input
                        id="c-dur"
                        value={duration}
                        placeholder="Se calcula con las fechas"
                        onChange={(e) => { setDurationTouched(true); setForm((f) => ({ ...f, duracion: e.target.value })); }}
                      />
                      {durationTouched && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => setDurationTouched(false)} aria-label="Recalcular duración">
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-total">Valor total</Label>
                    <Input id="c-total" type="number" inputMode="decimal" min={0} step="any" value={form.total_value} onChange={set("total_value")} />
                    {values.valor_letras && <p className="text-xs text-muted-foreground">{values.valor_letras}</p>}
                  </div>
                  {showField("sesiones") && (
                    <div className="space-y-1.5">
                      <Label htmlFor="c-ses">Sesiones / cantidad</Label>
                      <Input id="c-ses" value={form.sesiones} onChange={set("sesiones")} />
                    </div>
                  )}
                  {showField("forma_pago") && (
                    <div className="space-y-1.5">
                      <Label htmlFor="c-pago">Forma de pago</Label>
                      <Input id="c-pago" list="c-pago-opts" value={form.forma_pago} onChange={set("forma_pago")} placeholder="Efectivo, transferencia…" />
                      <datalist id="c-pago-opts">
                        <option value="efectivo" />
                        <option value="transferencia bancaria" />
                        <option value="tarjeta de crédito o débito" />
                        <option value="dos cuotas: 50% al firmar y 50% al finalizar" />
                      </datalist>
                    </div>
                  )}
                  {showField("servicios_incluidos") && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="c-incl">Servicios incluidos</Label>
                      <Textarea id="c-incl" rows={2} value={form.servicios_incluidos} onChange={set("servicios_incluidos")} placeholder="Alimentación, paseos, baño de salida…" />
                    </div>
                  )}
                  {showField("observaciones") && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="c-obs">Observaciones</Label>
                      <Textarea id="c-obs" rows={2} value={form.observaciones} onChange={set("observaciones")} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {(["cliente_telefono", "cliente_email", "cliente_direccion", "cliente_ciudad"] as const).some(showField) && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <h2 className="font-semibold">Datos del cliente</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {showField("cliente_telefono") && (
                      <div className="space-y-1.5"><Label htmlFor="c-tel">Teléfono</Label><Input id="c-tel" value={form.cliente_telefono} onChange={set("cliente_telefono")} /></div>
                    )}
                    {showField("cliente_email") && (
                      <div className="space-y-1.5"><Label htmlFor="c-mail">Email</Label><Input id="c-mail" value={form.cliente_email} onChange={set("cliente_email")} /></div>
                    )}
                    {showField("cliente_direccion") && (
                      <div className="space-y-1.5"><Label htmlFor="c-dir">Dirección</Label><Input id="c-dir" value={form.cliente_direccion} onChange={set("cliente_direccion")} /></div>
                    )}
                    {showField("cliente_ciudad") && (
                      <div className="space-y-1.5"><Label htmlFor="c-city">Ciudad</Label><Input id="c-city" value={form.cliente_ciudad} onChange={set("cliente_ciudad")} /></div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {customVars.length > 0 && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <h2 className="font-semibold">Otros datos de esta plantilla</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {customVars.map((k) => (
                      <div key={k} className="space-y-1.5">
                        <Label htmlFor={`c-x-${k}`}>{humanizeKey(k)}</Label>
                        <Input id={`c-x-${k}`} value={custom[k] ?? ""} onChange={(e) => setCustom((c) => ({ ...c, [k]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-2 xl:sticky xl:top-4 xl:self-start">
            <p className="text-sm font-medium">Vista previa</p>
            <ContractDocument html={html} className="max-h-[75vh] overflow-y-auto" />
          </div>
        </div>
      )}

      {/* ── Paso 4: revisar e imprimir ── */}
      {step === 3 && template && customer && (
        <div className="space-y-4">
          {savedId ? (
            <Card className="border-primary/40">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="h-5 w-5" /></div>
                  <div>
                    <p className="font-medium">Contrato guardado</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedDogs.length > 0 ? (
                        <>
                          Anexado al perfil de{" "}
                          {selectedDogs.map((d, i) => (
                            <span key={d.id}>
                              {i > 0 && (i === selectedDogs.length - 1 ? " y " : ", ")}
                              <Link to={`${basePath}/dogs/${d.id}?tab=contracts`} className="text-primary underline-offset-2 hover:underline">{d.name}</Link>
                            </span>
                          ))}
                          .{" "}
                        </>
                      ) : null}
                      Imprímelo para firma en papel o envíalo al cliente para que lo firme desde su celular.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => printContract(title, html)}><Printer className="h-4 w-4 mr-2" /> Imprimir</Button>
                  <Button variant="outline" onClick={() => setSendOpen(true)}><Send className="h-4 w-4 mr-2" /> Enviar para firma digital</Button>
                  <Button variant="ghost" onClick={restart}>Generar otro</Button>
                  <Button onClick={() => navigate("/contracts")}>Ver contratos</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-1.5 max-w-xl">
                  <Label htmlFor="c-title">Título del contrato</Label>
                  <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
                </div>
                {blanks.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-warning shrink-0" />
                    <span>
                      {blanks.length === 1 ? "Un campo quedará" : `${blanks.length} campos quedarán`} con una línea en blanco para llenar a mano:{" "}
                      <span className="text-muted-foreground">{blanks.map(humanizeKey).join(", ")}</span>.{" "}
                      <button type="button" className="underline underline-offset-2" onClick={() => setStep(2)}>Completar</button>
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => save("print")} disabled={createContract.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">
                    {createContract.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
                    Guardar e imprimir
                  </Button>
                  <Button variant="outline" onClick={() => save("send")} disabled={createContract.isPending || !customer.email}>
                    <Send className="h-4 w-4 mr-2" /> Guardar y enviar para firma digital
                  </Button>
                  <Button variant="ghost" onClick={() => save(null)} disabled={createContract.isPending}>Solo guardar</Button>
                </div>
              </CardContent>
            </Card>
          )}
          <ContractDocument html={html} />
        </div>
      )}

      <SendContractDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        contract={savedId ? { id: savedId, title, status: "generated", customerEmail: customer?.email ?? null } : null}
      />

      {/* Navegación */}
      {step < 3 && (
        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="ghost" onClick={() => (step === 0 ? navigate("/contracts") : setStep(step - 1))}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {step === 0 ? "Cancelar" : "Atrás"}
          </Button>
          <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
            {step === 2 ? "Revisar" : "Continuar"} <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
