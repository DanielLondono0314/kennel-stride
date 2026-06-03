import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCloseTarget } from "./useCloseTarget";
import type { ReportFormProps } from "./ReportRouter";

type RecordKind = "note" | "vaccine" | "deworming" | "condition";

/**
 * Vet report form → writes a clinical record to the chosen table, then closes
 * the item. QUIRK: medical_history / vaccination_schedule / deworming_records /
 * medical_conditions use `dog_id text` (NOT a uuid FK) and require `dog_name`.
 */
export function VetReportForm({ target, staffId, onDone }: ReportFormProps) {
  const { organization } = useOrganization();
  const { closeTask, closeReservation } = useCloseTarget(target, staffId);
  const [kind, setKind] = useState<RecordKind>("note");
  const [submitting, setSubmitting] = useState(false);

  // Clinical note (medical_history)
  const [note, setNote] = useState({ reason: "", diagnosis: "", treatment: "", notes: "" });
  // Vaccine (vaccination_schedule)
  const [vaccine, setVaccine] = useState({ vaccine_name: "", vaccine_type: "", next_dose_date: "" });
  // Deworming (deworming_records)
  const [deworming, setDeworming] = useState({ product_name: "", product_type: "", next_dose_date: "" });
  // Condition (medical_conditions)
  const [condition, setCondition] = useState({ condition_name: "", condition_type: "", severity: "mild", status: "active", treatment: "" });

  async function handleSubmit() {
    if (!target.dogId) {
      toast.error("Este elemento no tiene un perro asociado");
      return;
    }
    // Clinical tables use dog_id as TEXT.
    const dog_id = target.dogId;
    const dog_name = target.dogName ?? "";
    const organization_id = organization!.id;

    setSubmitting(true);
    try {
      if (kind === "note") {
        const { error } = await supabase.from("medical_history").insert({
          dog_id,
          dog_name,
          organization_id,
          record_type: "consultation",
          reason: note.reason || null,
          diagnosis: note.diagnosis || null,
          treatment: note.treatment || null,
          notes: note.notes || null,
          record_date: new Date().toISOString().slice(0, 10),
        } as never);
        if (error) throw error;
      } else if (kind === "vaccine") {
        if (!vaccine.vaccine_name.trim()) {
          toast.error("El nombre de la vacuna es obligatorio");
          setSubmitting(false);
          return;
        }
        const { error } = await supabase.from("vaccination_schedule").insert({
          dog_id,
          dog_name,
          organization_id,
          vaccine_name: vaccine.vaccine_name,
          vaccine_type: vaccine.vaccine_type || "core",
          date_administered: new Date().toISOString().slice(0, 10),
          next_dose_date: vaccine.next_dose_date || null,
        } as never);
        if (error) throw error;
      } else if (kind === "deworming") {
        if (!deworming.product_name.trim()) {
          toast.error("El nombre del producto es obligatorio");
          setSubmitting(false);
          return;
        }
        const { error } = await supabase.from("deworming_records").insert({
          dog_id,
          dog_name,
          organization_id,
          product_name: deworming.product_name,
          product_type: deworming.product_type || "internal",
          date_administered: new Date().toISOString().slice(0, 10),
          next_dose_date: deworming.next_dose_date || null,
        } as never);
        if (error) throw error;
      } else {
        if (!condition.condition_name.trim()) {
          toast.error("El nombre de la condición es obligatorio");
          setSubmitting(false);
          return;
        }
        const { error } = await supabase.from("medical_conditions").insert({
          dog_id,
          dog_name,
          organization_id,
          condition_name: condition.condition_name,
          condition_type: condition.condition_type || "chronic",
          severity: condition.severity,
          status: condition.status,
          treatment: condition.treatment || null,
        } as never);
        if (error) throw error;
      }

      if (target.kind === "task") {
        await closeTask({});
      } else {
        await closeReservation();
      }
      toast.success("Registro clínico guardado");
      onDone();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error guardando el registro");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Tabs value={kind} onValueChange={(v) => setKind(v as RecordKind)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="note">Nota</TabsTrigger>
          <TabsTrigger value="vaccine">Vacuna</TabsTrigger>
          <TabsTrigger value="deworming">Desparas.</TabsTrigger>
          <TabsTrigger value="condition">Condición</TabsTrigger>
        </TabsList>

        <TabsContent value="note" className="space-y-3 pt-2">
          <Field label="Motivo">
            <Input value={note.reason} onChange={(e) => setNote({ ...note, reason: e.target.value })} />
          </Field>
          <Field label="Diagnóstico">
            <Input value={note.diagnosis} onChange={(e) => setNote({ ...note, diagnosis: e.target.value })} />
          </Field>
          <Field label="Tratamiento">
            <Textarea rows={2} value={note.treatment} onChange={(e) => setNote({ ...note, treatment: e.target.value })} />
          </Field>
          <Field label="Notas">
            <Textarea rows={2} value={note.notes} onChange={(e) => setNote({ ...note, notes: e.target.value })} />
          </Field>
        </TabsContent>

        <TabsContent value="vaccine" className="space-y-3 pt-2">
          <Field label="Vacuna *">
            <Input value={vaccine.vaccine_name} onChange={(e) => setVaccine({ ...vaccine, vaccine_name: e.target.value })} />
          </Field>
          <Field label="Tipo">
            <Input value={vaccine.vaccine_type} onChange={(e) => setVaccine({ ...vaccine, vaccine_type: e.target.value })} placeholder="core" />
          </Field>
          <Field label="Próxima dosis">
            <Input type="date" value={vaccine.next_dose_date} onChange={(e) => setVaccine({ ...vaccine, next_dose_date: e.target.value })} />
          </Field>
        </TabsContent>

        <TabsContent value="deworming" className="space-y-3 pt-2">
          <Field label="Producto *">
            <Input value={deworming.product_name} onChange={(e) => setDeworming({ ...deworming, product_name: e.target.value })} />
          </Field>
          <Field label="Tipo">
            <Input value={deworming.product_type} onChange={(e) => setDeworming({ ...deworming, product_type: e.target.value })} placeholder="internal" />
          </Field>
          <Field label="Próxima dosis">
            <Input type="date" value={deworming.next_dose_date} onChange={(e) => setDeworming({ ...deworming, next_dose_date: e.target.value })} />
          </Field>
        </TabsContent>

        <TabsContent value="condition" className="space-y-3 pt-2">
          <Field label="Condición *">
            <Input value={condition.condition_name} onChange={(e) => setCondition({ ...condition, condition_name: e.target.value })} />
          </Field>
          <Field label="Tipo">
            <Input value={condition.condition_type} onChange={(e) => setCondition({ ...condition, condition_type: e.target.value })} placeholder="chronic" />
          </Field>
          <Field label="Severidad">
            <Input value={condition.severity} onChange={(e) => setCondition({ ...condition, severity: e.target.value })} placeholder="mild" />
          </Field>
          <Field label="Tratamiento">
            <Textarea rows={2} value={condition.treatment} onChange={(e) => setCondition({ ...condition, treatment: e.target.value })} />
          </Field>
        </TabsContent>
      </Tabs>

      <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Guardar y completar
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
