import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { emptyMedication, type MedicationRow, type MedRoute } from "@/types/dogClinical";

interface Props {
  value: MedicationRow[];
  onChange: (rows: MedicationRow[]) => void;
}

export function MedicationList({ value, onChange }: Props) {
  const update = (i: number, patch: Partial<MedicationRow>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, emptyMedication()]);

  return (
    <div className="space-y-4 rounded-lg border border-info/40 bg-info/10 p-4">
      {value.map((row, i) => (
        <div key={i} className="space-y-2 border-b border-border/60 pb-3 last:border-0 last:pb-0">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Medicamento *</Label>
              <Input value={row.name} onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Ej. Apoquel" />
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Quitar medicamento"
              onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Dosis</Label>
              <Input value={row.dose} onChange={(e) => update(i, { dose: e.target.value })} placeholder="Ej. 5mg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Frecuencia</Label>
              <Input value={row.frequency} onChange={(e) => update(i, { frequency: e.target.value })}
                placeholder="Ej. 2/día" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duración (días)</Label>
              <Input type="number" min={1} value={row.duration_days}
                onChange={(e) => update(i, { duration_days: e.target.value === "" ? "" : Number(e.target.value) })}
                placeholder="10" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Inicio</Label>
              <Input type="date" value={row.start_date}
                onChange={(e) => update(i, { start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vía</Label>
              <Select value={row.route} onValueChange={(v) => update(i, { route: v as MedRoute })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="oral">Oral</SelectItem>
                  <SelectItem value="topica">Tópica</SelectItem>
                  <SelectItem value="inyectable">Inyectable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={row.with_food} onCheckedChange={(c) => update(i, { with_food: c })} />
              <Label className="text-sm font-normal">Con comida</Label>
            </div>
          </div>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="text-xs text-primary" onClick={add}>
        <Plus className="h-3 w-3 mr-1" /> Añadir medicamento
      </Button>
    </div>
  );
}
