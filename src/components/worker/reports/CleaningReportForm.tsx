import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PhotoUploader } from "./PhotoUploader";
import { useCloseTarget } from "./useCloseTarget";
import type { ReportFormProps } from "./ReportRouter";

const CHECKLIST = [
  { key: "floor", label: "Piso barrido y trapeado" },
  { key: "feeders", label: "Comederos limpios" },
  { key: "water", label: "Agua fresca" },
  { key: "disinfection", label: "Desinfección de superficies" },
  { key: "waste", label: "Residuos retirados" },
] as const;

/** Cleaning report → checklist + notes + photos into the task's report_data. */
export function CleaningReportForm({ target, staffId, onDone }: ReportFormProps) {
  const { closeTask, closeReservation } = useCloseTarget(target, staffId);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      if (target.kind === "task") {
        await closeTask({
          report_data: { kind: "cleaning", checklist: checks },
          notes,
          photos,
        });
      } else {
        await closeReservation();
      }
      toast.success("Reporte guardado");
      onDone();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error guardando el reporte");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg bg-muted/50 p-4">
        {CHECKLIST.map((item) => (
          <label key={item.key} className="flex items-center gap-3 text-sm">
            <Checkbox
              checked={!!checks[item.key]}
              onCheckedChange={(c) => setChecks((s) => ({ ...s, [item.key]: !!c }))}
            />
            {item.label}
          </label>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label>Notas</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Observaciones…" />
      </div>

      <PhotoUploader photos={photos} onChange={setPhotos} label="Fotos (opcional)" />

      <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Guardar y completar
      </Button>
    </div>
  );
}
