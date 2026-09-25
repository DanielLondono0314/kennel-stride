import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveDogDashboardConfig } from "@/hooks/queries/useDogDashboard";
import {
  CARD_FIELDS, DASHBOARD_SECTIONS, DEFAULT_DOG_DASHBOARD_CONFIG,
  type CardField, type DashboardSection, type DogDashboardConfig,
} from "@/lib/dogDashboardConfig";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: DogDashboardConfig;
  canEdit: boolean;
}

function ToggleList<K extends string>({ labels, values, onChange, disabled }: {
  labels: Record<K, string>; values: Record<K, boolean>; onChange: (k: K, v: boolean) => void; disabled: boolean;
}) {
  return (
    <ul className="divide-y rounded-lg border">
      {(Object.keys(labels) as K[]).map((k) => (
        <li key={k} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <Label htmlFor={`cfg-${k}`} className="font-normal">{labels[k]}</Label>
          <Switch id={`cfg-${k}`} checked={values[k]} onCheckedChange={(v) => onChange(k, v)} disabled={disabled} />
        </li>
      ))}
    </ul>
  );
}

function NumberField({ id, label, hint, value, onChange, min, max, suffix, disabled }: {
  id: string; label: string; hint: string; value: number; onChange: (n: number) => void;
  min: number; max: number; suffix: string; disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id} type="number" min={min} max={max} value={value} disabled={disabled} className="w-24"
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function CustomizeDashboardSheet({ open, onOpenChange, config, canEdit }: Props) {
  const save = useSaveDogDashboardConfig();
  const [draft, setDraft] = useState(config);

  useEffect(() => { if (open) setDraft(config); }, [open, config]);

  const setSection = (k: DashboardSection, v: boolean) => setDraft((d) => ({ ...d, sections: { ...d.sections, [k]: v } }));
  const setField = (k: CardField, v: boolean) => setDraft((d) => ({ ...d, cardFields: { ...d.cardFields, [k]: v } }));
  const setWeight = (k: keyof DogDashboardConfig["weight"], v: number) => setDraft((d) => ({ ...d, weight: { ...d.weight, [k]: v } }));

  const w = draft.weight;
  const invalid =
    !Number.isInteger(w.checkIntervalDays) || w.checkIntervalDays < 1 || w.checkIntervalDays > 365 ||
    !(w.alertPct >= 1 && w.alertPct <= 50) ||
    !Number.isInteger(w.windowDays) || w.windowDays < 7 || w.windowDays > 365;

  const handleSave = async () => {
    try {
      await save.mutateAsync(draft);
      toast.success("Panel actualizado para todo el equipo");
      onOpenChange(false);
    } catch {
      toast.error("No se pudo guardar", { description: "Solo los administradores pueden cambiar esta configuración." });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle>Personalizar panel</SheetTitle>
          <SheetDescription>
            {canEdit
              ? "Elige qué ve tu equipo en el Panel de perros. Aplica a todos los usuarios del centro."
              : "Solo un administrador puede cambiar esta configuración."}
          </SheetDescription>
        </SheetHeader>

        <div className="-mx-6 flex-1 space-y-6 overflow-y-auto px-6 py-4">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Alertas de peso</h3>
            <NumberField
              id="cfg-interval" label="Pesar cada" suffix="días" min={1} max={365} disabled={!canEdit}
              value={w.checkIntervalDays} onChange={(n) => setWeight("checkIntervalDays", n)}
              hint="Después de este plazo sin pesar, el perro aparece como pendiente."
            />
            <NumberField
              id="cfg-pct" label="Alertar con variación de" suffix="%" min={1} max={50} disabled={!canEdit}
              value={w.alertPct} onChange={(n) => setWeight("alertPct", n)}
              hint="Subida o bajada respecto a la pesada de referencia. 5% es el criterio veterinario habitual."
            />
            <NumberField
              id="cfg-window" label="Comparar contra hace" suffix="días" min={7} max={365} disabled={!canEdit}
              value={w.windowDays} onChange={(n) => setWeight("windowDays", n)}
              hint="Ventana para medir la variación. Con menos historial se compara contra la primera pesada."
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Secciones visibles</h3>
            <ToggleList labels={DASHBOARD_SECTIONS} values={draft.sections} onChange={setSection} disabled={!canEdit} />
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Información de cada perro</h3>
            <ToggleList labels={CARD_FIELDS} values={draft.cardFields} onChange={setField} disabled={!canEdit} />
          </section>
        </div>

        {canEdit && (
          <SheetFooter className="gap-2 border-t pt-4 sm:justify-between">
            <Button variant="ghost" onClick={() => setDraft(DEFAULT_DOG_DASHBOARD_CONFIG)}>Restablecer</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={invalid || save.isPending}>Guardar</Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
