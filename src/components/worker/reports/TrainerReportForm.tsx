import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/report-cards/StarRating";
import { useCreateReportCard } from "@/hooks/queries/useReportCards";
import { PhotoUploader } from "./PhotoUploader";
import { useCloseTarget } from "./useCloseTarget";
import type { ReportFormProps } from "./ReportRouter";

const schema = z.object({
  energy_level: z.number().min(1).max(5),
  socialization: z.number().min(1).max(5),
  obedience: z.number().min(1).max(5),
  appetite: z.number().min(1).max(5),
  highlights: z.string(),
  areas_to_improve: z.string(),
  notes: z.string(),
  photos: z.array(z.string()),
});

const METRICS = [
  { key: "energy_level", label: "Energía" },
  { key: "socialization", label: "Socialización" },
  { key: "obedience", label: "Obediencia" },
  { key: "appetite", label: "Apetito" },
] as const;

/** Trainer report form → writes a report_cards row, then closes the item. */
export function TrainerReportForm({ target, staffId, onDone }: ReportFormProps) {
  const createReportCard = useCreateReportCard();
  const { closeTask, closeReservation } = useCloseTarget(target, staffId);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    energy_level: 3,
    socialization: 3,
    obedience: 3,
    appetite: 3,
    highlights: "",
    areas_to_improve: "",
    notes: "",
    photos: [] as string[],
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit() {
    if (!target.dogId) {
      toast.error("Este elemento no tiene un perro asociado");
      return;
    }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error("Revisa los datos del formulario");
      return;
    }
    const v = parsed.data;
    const overall_score = Math.round(
      (v.energy_level + v.socialization + v.obedience + v.appetite) / 4
    );

    setSubmitting(true);
    try {
      await createReportCard.mutateAsync({
        dog_id: target.dogId,
        dog_name: target.dogName,
        trainer_id: staffId,
        service_type: target.serviceType ?? "training_session",
        session_date: format(new Date(), "yyyy-MM-dd"),
        overall_score,
        energy_level: v.energy_level,
        socialization: v.socialization,
        obedience: v.obedience,
        appetite: v.appetite,
        highlights: v.highlights,
        areas_to_improve: v.areas_to_improve,
        notes: v.notes,
        photos: v.photos,
      });
      if (target.kind === "task") {
        await closeTask({ notes: v.notes, photos: v.photos });
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
      <div className="grid gap-3 rounded-lg bg-muted/50 p-4">
        {METRICS.map((m) => (
          <div key={m.key} className="flex items-center justify-between">
            <span className="text-sm font-medium">{m.label}</span>
            <StarRating value={form[m.key]} onChange={(val) => set(m.key, val)} />
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label>Logros destacados</Label>
        <Textarea
          value={form.highlights}
          onChange={(e) => set("highlights", e.target.value)}
          placeholder="Lo que hizo muy bien…"
          rows={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Áreas de mejora</Label>
        <Textarea
          value={form.areas_to_improve}
          onChange={(e) => set("areas_to_improve", e.target.value)}
          placeholder="En qué seguir trabajando…"
          rows={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Observaciones</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="¿Cómo estuvo hoy?"
          rows={3}
        />
      </div>

      <PhotoUploader photos={form.photos} onChange={(p) => set("photos", p)} />

      <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Guardar y completar
      </Button>
    </div>
  );
}
