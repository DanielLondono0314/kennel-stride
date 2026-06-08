import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { emptyAllergy, type AllergyRow, type AllergyType, type Severity } from "@/types/dogClinical";

interface Props {
  value: AllergyRow[];
  onChange: (rows: AllergyRow[]) => void;
}

export function AllergyList({ value, onChange }: Props) {
  const update = (i: number, patch: Partial<AllergyRow>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, emptyAllergy()]);

  return (
    <div className="space-y-4 rounded-lg border border-amber-600/40 bg-amber-600/10 p-4">
      {value.map((row, i) => (
        <div key={i} className="space-y-2 border-b border-border/60 pb-3 last:border-0 last:pb-0">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Alérgeno *</Label>
              <Input value={row.allergen} onChange={(e) => update(i, { allergen: e.target.value })}
                placeholder="Ej. pollo" />
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Quitar alergia"
              onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo *</Label>
              <Select value={row.type} onValueChange={(v) => update(i, { type: v as AllergyType })}>
                <SelectTrigger><SelectValue placeholder="Elegir…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comida">Comida</SelectItem>
                  <SelectItem value="ambiental">Ambiental</SelectItem>
                  <SelectItem value="medicamento">Medicamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reacción</Label>
              <Input value={row.reaction} onChange={(e) => update(i, { reaction: e.target.value })}
                placeholder="Ej. picor, vómito" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Severidad</Label>
              <Select value={row.severity} onValueChange={(v) => update(i, { severity: v as Severity })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="text-xs text-primary" onClick={add}>
        <Plus className="h-3 w-3 mr-1" /> Añadir alergia
      </Button>
    </div>
  );
}
