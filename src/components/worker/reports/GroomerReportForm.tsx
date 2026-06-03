import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhotoUploader } from "./PhotoUploader";
import { useCloseTarget } from "./useCloseTarget";
import type { ReportFormProps } from "./ReportRouter";

/** Groomer report → grooming notes + before/after photos into the task's report_data. */
export function GroomerReportForm({ target, staffId, onDone }: ReportFormProps) {
  const { closeTask, closeReservation } = useCloseTarget(target, staffId);
  const [service, setService] = useState("");
  const [notes, setNotes] = useState("");
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const allPhotos = [...beforePhotos, ...afterPhotos];
      if (target.kind === "task") {
        await closeTask({
          report_data: {
            kind: "grooming",
            service,
            before_photos: beforePhotos,
            after_photos: afterPhotos,
            notes,
          },
          notes,
          photos: allPhotos,
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
      <div className="space-y-1.5">
        <Label>Servicio realizado</Label>
        <Textarea
          value={service}
          onChange={(e) => setService(e.target.value)}
          rows={2}
          placeholder="Baño, corte, uñas…"
        />
      </div>

      <PhotoUploader photos={beforePhotos} onChange={setBeforePhotos} label="Fotos antes" />
      <PhotoUploader photos={afterPhotos} onChange={setAfterPhotos} label="Fotos después" />

      <div className="space-y-1.5">
        <Label>Notas</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Observaciones…" />
      </div>

      <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Guardar y completar
      </Button>
    </div>
  );
}
