import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAddWeightLog } from "@/hooks/queries/useDogWeightLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatKg, formatSignedPct } from "@/lib/weightTrend";

/** Escala WSAVA de condición corporal, agrupada para ayudar a elegir. */
const BCS_HINT: Record<number, string> = {
  1: "Emaciado", 2: "Muy delgado", 3: "Delgado", 4: "Ideal (bajo)", 5: "Ideal",
  6: "Sobrepeso leve", 7: "Sobrepeso", 8: "Obeso", 9: "Obesidad severa",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dogId: string;
  dogName: string;
  /** Último peso conocido, para advertir de errores de captura. */
  lastWeight?: number | null;
}

const today = () => format(new Date(), "yyyy-MM-dd");

export function WeightEntryDialog({ open, onOpenChange, dogId, dogName, lastWeight }: Props) {
  const addLog = useAddWeightLog(dogId);
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(today());
  const [bcs, setBcs] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setWeight(""); setDate(today()); setBcs(""); setNotes(""); setError(null); }
  }, [open]);

  const parsed = parseFloat(weight.replace(",", "."));
  const diffPct = lastWeight && Number.isFinite(parsed) && parsed > 0 ? ((parsed - lastWeight) / lastWeight) * 100 : null;
  // Un salto >15% casi siempre es un error de dedo (p. ej. 2.4 en vez de 24).
  const suspicious = diffPct !== null && Math.abs(diffPct) > 15;

  const handleSave = async () => {
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 200) {
      setError("Ingresa un peso válido en kg (entre 0 y 200).");
      return;
    }
    if (date > today()) {
      setError("La fecha no puede ser futura.");
      return;
    }
    try {
      await addLog.mutateAsync({
        weight: Math.round(parsed * 100) / 100,
        recorded_at: date,
        notes: notes.trim(),
        body_condition_score: bcs ? Number(bcs) : null,
      });
      toast.success(`Peso de ${dogName} registrado`);
      onOpenChange(false);
    } catch {
      toast.error("No se pudo guardar", { description: "Revisa tu conexión o tus permisos e inténtalo de nuevo." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar peso — {dogName}</DialogTitle>
          <DialogDescription>
            {lastWeight ? `Último peso conocido: ${formatKg(lastWeight)}.` : "Primera pesada de este perro."} Quedará registrado a tu nombre.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="weight-kg">Peso (kg)</Label>
              <Input
                id="weight-kg"
                inputMode="decimal"
                autoFocus
                value={weight}
                onChange={(e) => { setWeight(e.target.value); setError(null); }}
                placeholder="0,0"
                aria-invalid={!!error}
                aria-describedby={error ? "weight-error" : suspicious ? "weight-warning" : undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight-date">Fecha</Label>
              <Input id="weight-date" type="date" max={today()} value={date} onChange={(e) => { setDate(e.target.value); setError(null); }} />
            </div>
          </div>

          {error && <p id="weight-error" className="text-xs text-destructive">{error}</p>}
          {!error && suspicious && (
            <p id="weight-warning" className="text-xs rounded-md bg-warning/10 px-3 py-2 text-[hsl(26,83%,30%)]">
              Es un cambio de {formatSignedPct(Math.round(diffPct! * 10) / 10)} respecto al último peso. Verifica la báscula antes de guardar.
            </p>
          )}

          <div className="space-y-1.5">
            <Label id="bcs-label">Condición corporal <span className="font-normal text-muted-foreground">(opcional, 1–9)</span></Label>
            <ToggleGroup
              type="single"
              value={bcs}
              onValueChange={setBcs}
              aria-labelledby="bcs-label"
              className="grid grid-cols-9 gap-1"
            >
              {Array.from({ length: 9 }, (_, i) => String(i + 1)).map((v) => (
                <ToggleGroupItem
                  key={v}
                  value={v}
                  aria-label={`${v} — ${BCS_HINT[Number(v)]}`}
                  className="h-9 border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                >
                  {v}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-xs text-muted-foreground h-4">{bcs ? BCS_HINT[Number(bcs)] : "4–5 es el rango ideal"}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="weight-notes">Notas <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Textarea id="weight-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: comió poco ayer, más actividad esta semana…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={addLog.isPending || !weight}>Guardar peso</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
