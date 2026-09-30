import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDays, format } from "date-fns";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";
import { usePlanActions } from "@/hooks/queries/useDogPlans";
import { cn } from "@/lib/utils";
import { parseDateOnly, todayLocal } from "@/lib/age";
import { computeEndDate, type DogPlan } from "@/lib/dogPlans";
import { DEFAULT_INCLUDES, billingSummary, categoryForService, priceSummary, type CatalogService } from "@/lib/serviceCatalog";
import { CATEGORY_CONFIG } from "@/lib/reportCardServices";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Perros entre los que elegir (uno solo = ya elegido). */
  dogs: { id: string; name: string }[];
  defaultDogId?: string;
  /** Renovar: parte de este plan y empieza al día siguiente de su fin. */
  renewFrom?: DogPlan | null;
}

interface Form {
  dogId: string;
  serviceValue: string;
  startDate: string;
  endDate: string;
  quantityTotal: string;
  quantityUsed: string;
  price: string;
  includes: string[];
  conditions: string;
  notes: string;
}

export function AssignPlanDialog({ open, onOpenChange, dogs, defaultDogId, renewFrom }: Props) {
  const base = useOrgBasePath();
  const { catalog } = useServiceTypes();
  const { create } = usePlanActions();
  const [form, setForm] = useState<Form>(() => blank(defaultDogId ?? dogs[0]?.id ?? ""));
  const [customInclude, setCustomInclude] = useState("");
  const [endTouched, setEndTouched] = useState(false);

  // Solo servicios que se venden como plan (por duración o cantidad).
  const planServices = useMemo(() => catalog.filter((s) => s.active && s.billing !== "per_use"), [catalog]);
  const service: CatalogService | undefined = catalog.find((s) => s.value === form.serviceValue);
  const isQuantity = service?.billing === "quantity";

  useEffect(() => {
    if (!open) return;
    setCustomInclude("");
    setEndTouched(false);
    if (renewFrom) {
      const start = renewFrom.end_date ? format(addDays(parseDateOnly(renewFrom.end_date), 1), "yyyy-MM-dd") : todayLocal();
      const svc = catalog.find((s) => s.value === renewFrom.service_type);
      setForm({
        dogId: renewFrom.dog_id,
        serviceValue: renewFrom.service_type,
        startDate: start,
        endDate: svc?.duration ? computeEndDate(start, svc.duration.amount, svc.duration.unit) : "",
        quantityTotal: renewFrom.quantity_total ? String(renewFrom.quantity_total) : "",
        quantityUsed: "0",
        price: String(renewFrom.price ?? ""),
        includes: renewFrom.includes,
        conditions: renewFrom.conditions,
        notes: "",
      });
    } else {
      setForm(blank(defaultDogId ?? dogs[0]?.id ?? ""));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  function pickService(value: string) {
    const s = catalog.find((x) => x.value === value);
    if (!s) return;
    set({
      serviceValue: value,
      endDate: s.duration ? computeEndDate(form.startDate, s.duration.amount, s.duration.unit) : "",
      quantityTotal: s.quantity ? String(s.quantity.amount) : "",
      quantityUsed: "0",
      price: s.price != null ? String(s.price) : "",
      includes: s.includes,
      conditions: s.conditions,
    });
    setEndTouched(false);
  }

  function changeStart(startDate: string) {
    // La fecha de fin sigue al inicio mientras no la hayan editado a mano.
    if (service?.duration && !endTouched && startDate) {
      set({ startDate, endDate: computeEndDate(startDate, service.duration.amount, service.duration.unit) });
    } else {
      set({ startDate });
    }
  }

  const suggestions = useMemo(
    () => [...new Set([...(service?.includes ?? []), ...form.includes, ...DEFAULT_INCLUDES])],
    [service?.includes, form.includes]
  );

  function toggleInclude(item: string) {
    set({ includes: form.includes.includes(item) ? form.includes.filter((i) => i !== item) : [...form.includes, item] });
  }

  async function handleSave() {
    if (!form.dogId) return toast.error("Elige el perro");
    if (!service) return toast.error("Elige el servicio del plan");
    if (!form.startDate) return toast.error("Indica la fecha de inicio");
    if (!isQuantity && !form.endDate) return toast.error("Indica la fecha de fin");
    if (form.endDate && form.endDate < form.startDate) return toast.error("La fecha de fin no puede ser anterior al inicio");
    const total = parseInt(form.quantityTotal);
    const used = parseInt(form.quantityUsed || "0");
    if (isQuantity) {
      if (!(total > 0)) return toast.error(`Indica cuántas ${service.quantity?.unitLabel ?? "unidades"} incluye`);
      if (used < 0 || used > total) return toast.error("Lo ya usado no puede ser mayor que el total");
    }
    const price = form.price === "" ? 0 : Number(form.price);
    if (!(price >= 0)) return toast.error("El precio no es válido");

    try {
      await create.mutateAsync({
        dog_id: form.dogId,
        service_type: service.value,
        service_label: service.label,
        category: categoryForService(service),
        billing: isQuantity ? "quantity" : "duration",
        start_date: form.startDate,
        end_date: form.endDate || null,
        quantity_total: isQuantity ? total : null,
        quantity_used: isQuantity ? used : 0,
        unit_label: isQuantity ? service.quantity?.unitLabel ?? null : null,
        consumption: isQuantity ? service.quantity?.consumption ?? null : null,
        price,
        includes: form.includes,
        conditions: form.conditions.trim(),
        notes: form.notes.trim() || null,
      });
      toast.success(renewFrom ? "Plan renovado" : "Plan asignado");
      onOpenChange(false);
    } catch (e) {
      toast.error("No se pudo guardar el plan", { description: e instanceof Error ? e.message : undefined });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{renewFrom ? "Renovar plan" : "Asignar plan"}</DialogTitle>
          <DialogDescription>
            Se toman la duración, el precio y lo que incluye del servicio; puedes ajustarlos para este perro.
          </DialogDescription>
        </DialogHeader>

        {planServices.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm">
            <p className="font-medium">Aún no hay servicios que se vendan como plan.</p>
            <p className="mt-1 text-muted-foreground">
              En Configuración → Servicios, marca los servicios que se venden por duración o por cantidad.
            </p>
            <Link to={`${base}/settings?tab=services`} className="mt-2 inline-block font-medium text-primary underline underline-offset-2">
              Ir a Servicios
            </Link>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="grid gap-3 sm:grid-cols-2">
              {dogs.length > 1 && (
                <div className="space-y-1.5">
                  <Label htmlFor="plan-dog">Perro *</Label>
                  <Select value={form.dogId} onValueChange={(v) => set({ dogId: v })}>
                    <SelectTrigger id="plan-dog"><SelectValue placeholder="Elegir" /></SelectTrigger>
                    <SelectContent>
                      {dogs.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className={cn("space-y-1.5", dogs.length <= 1 && "sm:col-span-2")}>
                <Label htmlFor="plan-service">Servicio *</Label>
                <Select value={form.serviceValue} onValueChange={pickService}>
                  <SelectTrigger id="plan-service"><SelectValue placeholder="Elegir servicio" /></SelectTrigger>
                  <SelectContent>
                    {planServices.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {CATEGORY_CONFIG[categoryForService(s)].icon} {s.label} · {billingSummary(s)}{priceSummary(s) ? ` · ${priceSummary(s)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {service && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-start">Inicio *</Label>
                    <Input id="plan-start" type="date" value={form.startDate} onChange={(e) => changeStart(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Puede ser una fecha pasada si el plan ya estaba en curso.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-end">{isQuantity ? "Usar antes de (opcional)" : "Fin *"}</Label>
                    <Input
                      id="plan-end"
                      type="date"
                      min={form.startDate}
                      value={form.endDate}
                      onChange={(e) => { set({ endDate: e.target.value }); setEndTouched(true); }}
                    />
                  </div>
                </div>

                {isQuantity && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="plan-total">Total de {service.quantity?.unitLabel} *</Label>
                      <Input id="plan-total" type="number" min={1} value={form.quantityTotal} onChange={(e) => set({ quantityTotal: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="plan-used">Ya usadas</Label>
                      <Input id="plan-used" type="number" min={0} value={form.quantityUsed} onChange={(e) => set({ quantityUsed: e.target.value })} />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 sm:w-1/2">
                  <Label htmlFor="plan-price">Precio (COP)</Label>
                  <Input id="plan-price" type="number" min={0} step={1000} inputMode="numeric" value={form.price} onChange={(e) => set({ price: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <Label>Incluye</Label>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Qué incluye el plan">
                    {suggestions.map((item) => {
                      const on = form.includes.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleInclude(item)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium",
                            on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                          )}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={customInclude}
                      onChange={(e) => setCustomInclude(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customInclude.trim()) {
                          e.preventDefault();
                          if (!form.includes.includes(customInclude.trim())) set({ includes: [...form.includes, customInclude.trim()] });
                          setCustomInclude("");
                        }
                      }}
                      placeholder="Agregar otro beneficio"
                      aria-label="Agregar otro beneficio"
                      className="h-9"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!customInclude.trim()}
                      onClick={() => {
                        if (!form.includes.includes(customInclude.trim())) set({ includes: [...form.includes, customInclude.trim()] });
                        setCustomInclude("");
                      }}
                      className="gap-1"
                    >
                      <Plus className="h-4 w-4" /> Agregar
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="plan-conditions">Condiciones</Label>
                  <Textarea id="plan-conditions" rows={2} value={form.conditions} onChange={(e) => set({ conditions: e.target.value })} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="plan-notes">Notas internas</Label>
                  <Textarea
                    id="plan-notes"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => set({ notes: e.target.value })}
                    placeholder="Ej. Pagó por transferencia el 1 sep. Plan cargado desde el registro anterior."
                  />
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {planServices.length > 0 && (
            <Button onClick={handleSave} disabled={create.isPending || !service}>
              {renewFrom ? "Renovar plan" : "Asignar plan"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function blank(dogId: string): Form {
  return {
    dogId,
    serviceValue: "",
    startDate: todayLocal(),
    endDate: "",
    quantityTotal: "",
    quantityUsed: "0",
    price: "",
    includes: [],
    conditions: "",
    notes: "",
  };
}
