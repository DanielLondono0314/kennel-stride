import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DetailValue, FieldDef } from "@/lib/reportCardServices";

interface ServiceFieldsProps {
  fields: FieldDef[];
  values: Record<string, DetailValue>;
  onChange: (key: string, value: DetailValue) => void;
}

/** Campos propios de la categoría del servicio (grooming, veterinaria, paseo…). */
export function ServiceFields({ fields, values, onChange }: ServiceFieldsProps) {
  if (fields.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fields.map((field) => {
        const id = `rc-field-${field.key}`;
        const wide = field.type === "textarea" || field.type === "checklist";
        return (
          <div key={field.key} className={cn("space-y-1.5", wide && "sm:col-span-2")}>
            <Label htmlFor={field.type === "checklist" ? undefined : id}>
              {field.label}
              {field.type === "number" && field.unit ? ` (${field.unit})` : ""}
            </Label>
            <FieldInput id={id} field={field} value={values[field.key]} onChange={(v) => onChange(field.key, v)} />
          </div>
        );
      })}
    </div>
  );
}

function FieldInput({
  id,
  field,
  value,
  onChange,
}: {
  id: string;
  field: FieldDef;
  value: DetailValue | undefined;
  onChange: (v: DetailValue) => void;
}) {
  switch (field.type) {
    case "textarea":
      return (
        <Textarea id={id} rows={2} value={(value as string) ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
      );
    case "text":
      return <Input id={id} value={(value as string) ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return (
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={field.step ?? 1}
          value={value === undefined || value === "" ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
      );
    case "date":
      return <Input id={id} type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <Select value={(value as string) || undefined} onValueChange={onChange}>
          <SelectTrigger id={id}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
          <SelectContent>
            {field.options.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "checklist": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-2" role="group" aria-label={field.label}>
          {field.options.map((o) => {
            const on = selected.includes(o);
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? selected.filter((x) => x !== o) : [...selected, o])}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
                )}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    }
  }
}
