import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCloseTarget } from "./useCloseTarget";
import type { ReportFormProps } from "./ReportRouter";

type Activity = "feeding" | "walk";

/** Welfare report → structured feeding/walk log into the task's report_data. */
export function WelfareReportForm({ target, staffId, onDone }: ReportFormProps) {
  const { closeTask, closeReservation } = useCloseTarget(target, staffId);
  const [activity, setActivity] = useState<Activity>("feeding");
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [amount, setAmount] = useState(""); // grams for feeding
  const [duration, setDuration] = useState(""); // minutes for walk
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const report_data =
        activity === "feeding"
          ? { kind: "feeding", time, amount, notes }
          : { kind: "walk", time, duration, notes };
      if (target.kind === "task") {
        await closeTask({ report_data, notes });
      } else {
        await closeReservation();
      }
      toast.success("Registro guardado");
      onDone();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error guardando el registro");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Tabs value={activity} onValueChange={(v) => setActivity(v as Activity)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="feeding">Alimentación</TabsTrigger>
          <TabsTrigger value="walk">Paseo</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-1.5">
        <Label>Hora</Label>
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>

      {activity === "feeding" ? (
        <div className="space-y-1.5">
          <Label>Cantidad (g)</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ej. 250" />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Duración (min)</Label>
          <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Ej. 30" />
        </div>
      )}

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
