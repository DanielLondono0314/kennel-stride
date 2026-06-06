import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AggressionForm, Severity } from "@/types/dogClinical";

interface Props {
  value: AggressionForm;
  onChange: (v: AggressionForm) => void;
}

export function AggressionFields({ value, onChange }: Props) {
  const set = (patch: Partial<AggressionForm>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="aggr-severity" className="text-xs">Severidad *</Label>
          <Select value={value.severity} onValueChange={(v) => set({ severity: v as Severity })}>
            <SelectTrigger id="aggr-severity"><SelectValue placeholder="Elegir…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="baja">Baja</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="aggr-handling" className="text-xs">Manejo *</Label>
        <Textarea id="aggr-handling" rows={2} value={value.handling}
          onChange={(e) => set({ handling: e.target.value })}
          placeholder="Cómo manejarlo de forma segura…" />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-3">
          <Switch checked={value.requires_muzzle} onCheckedChange={(c) => set({ requires_muzzle: c })} />
          <Label className="text-sm font-normal">Requiere bozal</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={value.handle_alone} onCheckedChange={(c) => set({ handle_alone: c })} />
          <Label className="text-sm font-normal">Manejar a solas</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={value.no_other_dogs} onCheckedChange={(c) => set({ no_other_dogs: c })} />
          <Label className="text-sm font-normal">No con otros perros</Label>
        </div>
      </div>
    </div>
  );
}
