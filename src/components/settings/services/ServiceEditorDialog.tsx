import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { zodFieldErrors } from "@/lib/forms";
import { CATEGORY_CONFIG, SERVICE_CATEGORIES, inferCategory } from "@/lib/reportCardServices";
import {
  BILLING_HELP, BILLING_LABELS, CONSUMPTION_LABELS, DEFAULT_INCLUDES, DURATION_UNIT_LABELS,
  catalogServiceSchema, categoryForService, slugify,
  type BillingMode, type CatalogService, type Consumption, type DurationUnit,
} from "@/lib/serviceCatalog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = servicio nuevo. */
  service: CatalogService | null;
  /** value de los demás servicios, para no repetir. */
  takenValues: string[];
  /** "Incluye" usados en otros servicios del centro: se sugieren también. */
  knownIncludes: string[];
  saving: boolean;
  onSave: (service: CatalogService) => void;
}

const empty = (): CatalogService => ({
  value: "",
  label: "",
  billing: "per_use",
  duration: null,
  quantity: null,
  price: null,
  includes: [],
  conditions: "",
  active: true,
});

export function ServiceEditorDialog({ open, onOpenChange, service, takenValues, knownIncludes, saving, onSave }: Props) {
  const [form, setForm] = useState<CatalogService>(empty);
  const [customInclude, setCustomInclude] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isNew = !service;

  useEffect(() => {
    if (!open) return;
    setForm(service ? { ...service } : empty());
    setCustomInclude("");
    setErrors({});
  }, [open, service]);

  const suggestions = useMemo(
    () => [...new Set([...DEFAULT_INCLUDES, ...knownIncludes, ...form.includes])],
    [knownIncludes, form.includes]
  );

  const set = (patch: Partial<CatalogService>) => setForm((f) => ({ ...f, ...patch }));

  const setBilling = (billing: BillingMode) =>
    set({
      billing,
      duration: billing === "duration" ? form.duration ?? { amount: 1, unit: "months" } : form.duration,
      quantity: billing === "quantity" ? form.quantity ?? { amount: 10, unitLabel: "sesiones", consumption: "per_visit" } : form.quantity,
    });

  const toggleInclude = (item: string) =>
    set({ includes: form.includes.includes(item) ? form.includes.filter((i) => i !== item) : [...form.includes, item] });

  const addCustomInclude = () => {
    const v = customInclude.trim();
    if (!v) return;
    if (!form.includes.some((i) => i.toLowerCase() === v.toLowerCase())) set({ includes: [...form.includes, v] });
    setCustomInclude("");
  };

  const handleSave = () => {
    const value = isNew ? slugify(form.label) || `servicio_${Date.now()}` : form.value;
    if (isNew && takenValues.includes(value)) {
      setErrors({ label: "Ya existe un servicio con ese nombre" });
      return;
    }
    const candidate: CatalogService = {
      ...form,
      value,
      category: form.category ?? inferCategory(value, form.label),
      duration: form.billing === "duration" ? form.duration : null,
      quantity: form.billing === "quantity" ? form.quantity : null,
    };
    const parsed = catalogServiceSchema.safeParse(candidate);
    if (!parsed.success) {
      const errs = zodFieldErrors(parsed.error);
      setErrors(errs);
      return;
    }
    onSave(candidate);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nuevo servicio" : `Editar ${service?.label}`}</DialogTitle>
          <DialogDescription>Define cómo se vende este servicio en tu centro, qué incluye y sus condiciones.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="svc-name">Nombre *</Label>
              <Input
                id="svc-name"
                value={form.label}
                onChange={(e) => { set({ label: e.target.value }); setErrors((x) => ({ ...x, label: "" })); }}
                placeholder="Ej. Internado + Entrenamiento"
                aria-invalid={errors.label ? true : undefined}
              />
              {errors.label && <p className="text-xs text-destructive">{errors.label}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-category">Tipo de servicio</Label>
              <Select
                value={form.category ?? categoryForService({ ...form, value: form.value || slugify(form.label) })}
                onValueChange={(v) => set({ category: v })}
              >
                <SelectTrigger id="svc-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_CONFIG[c].icon} {CATEGORY_CONFIG[c].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Define qué se diligencia en el report card.</p>
            </div>
          </div>

          {/* Modalidad */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">¿Cómo se vende?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["duration", "quantity", "per_use"] as BillingMode[]).map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={form.billing === b}
                  onClick={() => setBilling(b)}
                  className={cn(
                    "rounded-lg border p-3 text-left text-sm transition-colors",
                    form.billing === b ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
                  )}
                >
                  <span className="block font-medium">{BILLING_LABELS[b]}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{BILLING_HELP[b]}</span>
                </button>
              ))}
            </div>

            {form.billing === "duration" && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="svc-dur">Duración *</Label>
                  <Input
                    id="svc-dur"
                    type="number"
                    min={1}
                    value={form.duration?.amount ?? ""}
                    onChange={(e) => set({ duration: { unit: form.duration?.unit ?? "months", amount: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="svc-dur-unit">Unidad</Label>
                  <Select
                    value={form.duration?.unit ?? "months"}
                    onValueChange={(v) => set({ duration: { amount: form.duration?.amount ?? 1, unit: v as DurationUnit } })}
                  >
                    <SelectTrigger id="svc-dur-unit"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(DURATION_UNIT_LABELS) as DurationUnit[]).map((u) => (
                        <SelectItem key={u} value={u}>{DURATION_UNIT_LABELS[u][1]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {errors.duration && <p className="col-span-2 text-xs text-destructive">{errors.duration}</p>}
              </div>
            )}

            {form.billing === "quantity" && (
              <div className="grid gap-3 pt-1 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="svc-qty">Cantidad *</Label>
                  <Input
                    id="svc-qty"
                    type="number"
                    min={1}
                    value={form.quantity?.amount ?? ""}
                    onChange={(e) => set({ quantity: { unitLabel: form.quantity?.unitLabel ?? "sesiones", consumption: form.quantity?.consumption ?? "per_visit", amount: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="svc-qty-unit">Qué se cuenta *</Label>
                  <Input
                    id="svc-qty-unit"
                    value={form.quantity?.unitLabel ?? ""}
                    placeholder="clases, días, sesiones"
                    onChange={(e) => set({ quantity: { amount: form.quantity?.amount ?? 10, consumption: form.quantity?.consumption ?? "per_visit", unitLabel: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="svc-qty-cons">Se descuenta</Label>
                  <Select
                    value={form.quantity?.consumption ?? "per_visit"}
                    onValueChange={(v) => set({ quantity: { amount: form.quantity?.amount ?? 10, unitLabel: form.quantity?.unitLabel ?? "sesiones", consumption: v as Consumption } })}
                  >
                    <SelectTrigger id="svc-qty-cons"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CONSUMPTION_LABELS) as Consumption[]).map((c) => (
                        <SelectItem key={c} value={c}>{CONSUMPTION_LABELS[c]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {errors.quantity && <p className="text-xs text-destructive sm:col-span-3">{errors.quantity}</p>}
              </div>
            )}
          </fieldset>

          <div className="space-y-1.5 sm:w-1/2">
            <Label htmlFor="svc-price">Precio de referencia (COP)</Label>
            <Input
              id="svc-price"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={form.price ?? ""}
              placeholder="Opcional"
              onChange={(e) => set({ price: e.target.value === "" ? null : Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">Se propone al asignar el plan; se puede ajustar por cliente.</p>
          </div>

          {/* Incluye */}
          <div className="space-y-2">
            <Label>Incluye</Label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Qué incluye el servicio">
              {suggestions.map((item) => {
                const on = form.includes.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleInclude(item)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
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
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomInclude(); } }}
                placeholder="Agregar otro (ej. Piscina)"
                aria-label="Agregar otro beneficio"
                className="h-9"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustomInclude} disabled={!customInclude.trim()} className="gap-1">
                <Plus className="h-4 w-4" /> Agregar
              </Button>
            </div>
            {form.includes.filter((i) => !DEFAULT_INCLUDES.includes(i) && !knownIncludes.includes(i)).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.includes.filter((i) => !DEFAULT_INCLUDES.includes(i) && !knownIncludes.includes(i)).map((i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                    {i}
                    <button type="button" onClick={() => toggleInclude(i)} aria-label={`Quitar ${i}`}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="svc-conditions">Condiciones</Label>
            <Textarea
              id="svc-conditions"
              rows={3}
              value={form.conditions}
              onChange={(e) => set({ conditions: e.target.value })}
              placeholder="Ej. Incluye 2 visitas de seguimiento. No es reembolsable. Las clases no tomadas no se acumulan."
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Servicio activo</p>
              <p className="text-xs text-muted-foreground">Desactivado no aparece al crear reservas ni planes; lo existente se conserva.</p>
            </div>
            <Switch checked={form.active} onCheckedChange={(c) => set({ active: c })} aria-label="Servicio activo" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{isNew ? "Crear servicio" : "Guardar cambios"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
