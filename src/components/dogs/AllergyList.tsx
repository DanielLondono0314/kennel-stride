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
    <div className="space-y-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
      {value.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Alérgeno *</Label>
            <Input value={row.allergen} onChange={(e) => update(i, { allergen: e.target.value })}
              placeholder="Ej. pollo" />
          </div>
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
          <Button type="button" variant="ghost" size="icon" aria-label="Quitar alergia"
            onClick={() => remove(i)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
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
      ))}
      <Button type="button" variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary" onClick={add}>
        <Plus className="h-3 w-3 mr-1" /> Añadir alergia
      </Button>
    </div>
  );
}
