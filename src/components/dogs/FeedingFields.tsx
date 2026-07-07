import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UtensilsCrossed, AlertTriangle } from "lucide-react";
import type { FeedingForm, FoodType, PortionUnit } from "@/types/dogClinical";

interface Props {
  value: FeedingForm;
  onChange: (v: FeedingForm) => void;
  foodAllergyWarning?: string[];
  /** Errores inline por campo (food_type, meals_per_day). */
  errors?: Partial<Record<"food_type" | "meals_per_day", string>>;
}

export function FeedingFields({ value, onChange, foodAllergyWarning = [], errors = {} }: Props) {
  const set = (patch: Partial<FeedingForm>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <Label className="flex items-center gap-2 text-sm font-semibold">
        <UtensilsCrossed className="h-4 w-4" /> Alimentación *
      </Label>

      {foodAllergyWarning.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Alergias alimentarias: {foodAllergyWarning.join(", ")}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="feeding-type" className="text-xs">Tipo de comida *</Label>
          <Select value={value.food_type} onValueChange={(v) => set({ food_type: v as FoodType })}>
            <SelectTrigger
              id="feeding-type"
              aria-invalid={errors.food_type ? true : undefined}
              aria-describedby={errors.food_type ? "feeding-type-error" : undefined}
              className={errors.food_type ? "border-destructive focus:ring-destructive" : ""}
            ><SelectValue placeholder="Elegir…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="seco">Seco</SelectItem>
              <SelectItem value="humedo">Húmedo</SelectItem>
              <SelectItem value="crudo">Crudo</SelectItem>
              <SelectItem value="mixto">Mixto</SelectItem>
            </SelectContent>
          </Select>
          {errors.food_type && <p id="feeding-type-error" className="text-xs text-destructive">{errors.food_type}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="feeding-brand" className="text-xs">Marca / producto</Label>
          <Input id="feeding-brand" value={value.brand}
            onChange={(e) => set({ brand: e.target.value })} placeholder="Marca…" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="feeding-meals" className="text-xs">Comidas al día *</Label>
          <Input id="feeding-meals" type="number" min={1} value={value.meals_per_day}
            onChange={(e) => set({ meals_per_day: e.target.value === "" ? "" : Number(e.target.value) })}
            aria-invalid={errors.meals_per_day ? true : undefined}
            aria-describedby={errors.meals_per_day ? "feeding-meals-error" : undefined}
            className={errors.meals_per_day ? "border-destructive focus-visible:ring-destructive" : ""}
            placeholder="2" />
          {errors.meals_per_day && <p id="feeding-meals-error" className="text-xs text-destructive">{errors.meals_per_day}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="feeding-portion" className="text-xs">Porción</Label>
          <Input id="feeding-portion" type="number" min={0} value={value.portion_amount}
            onChange={(e) => set({ portion_amount: e.target.value === "" ? "" : Number(e.target.value) })}
            placeholder="150" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="feeding-unit" className="text-xs">Unidad</Label>
          <Select value={value.portion_unit} onValueChange={(v) => set({ portion_unit: v as PortionUnit })}>
            <SelectTrigger id="feeding-unit"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="g">g</SelectItem>
              <SelectItem value="taza">taza</SelectItem>
              <SelectItem value="scoop">scoop</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="feeding-instructions" className="text-xs">Instrucciones especiales</Label>
        <Textarea id="feeding-instructions" rows={2} value={value.instructions}
          onChange={(e) => set({ instructions: e.target.value })}
          placeholder="Ej. remojar el pienso, separar de otros perros…" />
      </div>
    </div>
  );
}
