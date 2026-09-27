import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/report-cards/StarRating";
import { useCreateReportCard } from "@/hooks/queries/useReportCards";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { PhotoUploader } from "./PhotoUploader";
import { useCloseTarget } from "./useCloseTarget";
import type { ReportFormProps } from "./ReportRouter";

/**
 * Groomer report → grooming notes + before/after photos into the task's
 * report_data, y además un report card (borrador) para que el servicio quede
 * en el historial del perro y se pueda enviar al dueño.
 */
export function GroomerReportForm({ target, staffId, onDone }: ReportFormProps) {
  const { closeTask, closeReservation } = useCloseTarget(target, staffId);
  const createReportCard = useCreateReportCard();
  const { labels: serviceLabels } = useServiceTypes();
  const [overall, setOverall] = useState(3);
  const [behavior, setBehavior] = useState(3);
  const [service, setService] = useState("");
  const [notes, setNotes] = useState("");
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const allPhotos = [...beforePhotos, ...afterPhotos];
      if (target.dogId) {
        const serviceType = target.serviceType ?? "grooming";
        await createReportCard.mutateAsync({
          dog_id: target.dogId,
          dog_name: target.dogName ?? "",
          trainer_id: staffId,
          service_type: serviceType,
          service_category: "grooming",
          session_date: format(new Date(), "yyyy-MM-dd"),
          overall_score: overall,
          energy_level: null,
          socialization: null,
          obedience: null,
          appetite: null,
          // El servicio es texto libre: va en las observaciones para que no se
          // pierda si luego editan el report card con el formulario completo.
          notes: [service.trim() && `Servicio realizado: ${service.trim()}`, notes.trim()].filter(Boolean).join("\n"),
          photos: allPhotos,
          details: {
            ratings: { behavior },
            metrics: [
              { label: "Puntuación general", value: overall },
              { label: "Comportamiento durante el servicio", value: behavior },
            ],
            service_label: serviceLabels[serviceType] ?? "Grooming",
            staff_label: "Groomer",
          },
        });
      }
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

      <div className="grid gap-3 rounded-lg bg-muted/50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Cómo estuvo</span>
          <StarRating value={overall} onChange={setOverall} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Comportamiento</span>
          <StarRating value={behavior} onChange={setBehavior} />
        </div>
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
