import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, FileText, Thermometer, Heart, Weight, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  dogId: string;
  dogName: string;
}

const recordTypes: Record<string, { label: string; color: string }> = {
  consultation: { label: "Consulta", color: "bg-info/10 text-info" },
  surgery: { label: "Cirugía", color: "bg-destructive/10 text-destructive" },
  emergency: { label: "Emergencia", color: "bg-destructive/10 text-destructive" },
  checkup: { label: "Chequeo", color: "bg-success/10 text-success" },
  dental: { label: "Dental", color: "bg-warning/10 text-warning" },
  laboratory: { label: "Laboratorio", color: "bg-primary/10 text-primary" },
  imaging: { label: "Imagen", color: "bg-primary/10 text-primary" },
};

export function MedicalHistoryTab({ dogId, dogName }: Props) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    record_date: new Date().toISOString().split("T")[0],
    record_type: "consultation",
    veterinarian: "",
    reason: "",
    diagnosis: "",
    treatment: "",
    prescription: "",
    weight: "",
    temperature: "",
    heart_rate: "",
    respiratory_rate: "",
    blood_pressure: "",
    body_condition_score: "",
    notes: "",
    next_appointment: "",
  });

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("medical_history")
      .select("*")
      .eq("dog_id", dogId)
      .order("record_date", { ascending: false });
    if (!error && data) setRecords(data);
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, [dogId]);

  const resetForm = () => {
    setForm({
      record_date: new Date().toISOString().split("T")[0],
      record_type: "consultation",
      veterinarian: "",
      reason: "",
      diagnosis: "",
      treatment: "",
      prescription: "",
      weight: "",
      temperature: "",
      heart_rate: "",
      respiratory_rate: "",
      blood_pressure: "",
      body_condition_score: "",
      notes: "",
      next_appointment: "",
    });
  };

  const handleSave = async () => {
    const { error } = await supabase.from("medical_history").insert({
      dog_id: dogId,
      dog_name: dogName,
      record_date: form.record_date,
      record_type: form.record_type,
      veterinarian: form.veterinarian,
      reason: form.reason,
      diagnosis: form.diagnosis,
      treatment: form.treatment,
      prescription: form.prescription,
      weight: form.weight ? parseFloat(form.weight) : null,
      temperature: form.temperature ? parseFloat(form.temperature) : null,
      heart_rate: form.heart_rate ? parseInt(form.heart_rate) : null,
      respiratory_rate: form.respiratory_rate ? parseInt(form.respiratory_rate) : null,
      blood_pressure: form.blood_pressure,
      body_condition_score: form.body_condition_score ? parseInt(form.body_condition_score) : null,
      notes: form.notes,
      next_appointment: form.next_appointment || null,
    });
    if (error) {
      toast.error("Error al guardar registro");
    } else {
      toast.success("Registro médico guardado");
      setModalOpen(false);
      resetForm();
      fetchRecords();
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Historial Médico</h3>
        <Button onClick={() => { resetForm(); setModalOpen(true); }} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Nueva Consulta
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No hay registros médicos aún.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <Card key={r.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={recordTypes[r.record_type]?.color || "bg-muted text-muted-foreground"}>
                      {recordTypes[r.record_type]?.label || r.record_type}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(r.record_date), "dd MMM yyyy", { locale: es })}
                    </span>
                  </div>
                  {r.veterinarian && (
                    <span className="text-xs text-muted-foreground">Dr. {r.veterinarian}</span>
                  )}
                </div>
                {r.reason && <p className="text-sm font-medium text-foreground mb-1">Motivo: {r.reason}</p>}
                {r.diagnosis && <p className="text-sm text-foreground mb-1">Diagnóstico: {r.diagnosis}</p>}
                {r.treatment && <p className="text-sm text-muted-foreground mb-1">Tratamiento: {r.treatment}</p>}
                {r.prescription && <p className="text-sm text-muted-foreground mb-1">Prescripción: {r.prescription}</p>}

                {/* Vitals row */}
                <div className="flex flex-wrap gap-3 mt-2">
                  {r.weight && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      <Weight className="h-3 w-3" /> {r.weight} kg
                    </span>
                  )}
                  {r.temperature && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      <Thermometer className="h-3 w-3" /> {r.temperature}°C
                    </span>
                  )}
                  {r.heart_rate && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      <Heart className="h-3 w-3" /> {r.heart_rate} bpm
                    </span>
                  )}
                  {r.respiratory_rate && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      Resp: {r.respiratory_rate}/min
                    </span>
                  )}
                  {r.blood_pressure && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      PA: {r.blood_pressure}
                    </span>
                  )}
                </div>

                {r.next_appointment && (
                  <p className="text-xs text-info mt-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Próxima cita: {format(new Date(r.next_appointment), "dd MMM yyyy", { locale: es })}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New record modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Registro Médico — {dogName}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} />
            </div>
            <div>
              <Label>Tipo de Registro</Label>
              <Select value={form.record_type} onValueChange={(v) => setForm({ ...form, record_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(recordTypes).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Veterinario</Label>
              <Input value={form.veterinarian} onChange={(e) => setForm({ ...form, veterinarian: e.target.value })} placeholder="Nombre del veterinario" />
            </div>
            <div>
              <Label>Próxima Cita</Label>
              <Input type="date" value={form.next_appointment} onChange={(e) => setForm({ ...form, next_appointment: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Motivo de Consulta</Label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Razón de la visita" />
            </div>
            <div className="col-span-2">
              <Label>Diagnóstico</Label>
              <Textarea value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="Diagnóstico" />
            </div>
            <div className="col-span-2">
              <Label>Tratamiento</Label>
              <Textarea value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} placeholder="Tratamiento indicado" />
            </div>
            <div className="col-span-2">
              <Label>Prescripción</Label>
              <Textarea value={form.prescription} onChange={(e) => setForm({ ...form, prescription: e.target.value })} placeholder="Medicamentos prescritos" />
            </div>

            {/* Vitals */}
            <p className="col-span-2 text-sm font-semibold text-foreground mt-2">Signos Vitales</p>
            <div>
              <Label>Peso (kg)</Label>
              <Input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </div>
            <div>
              <Label>Temperatura (°C)</Label>
              <Input type="number" step="0.1" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} />
            </div>
            <div>
              <Label>Frec. Cardíaca (bpm)</Label>
              <Input type="number" value={form.heart_rate} onChange={(e) => setForm({ ...form, heart_rate: e.target.value })} />
            </div>
            <div>
              <Label>Frec. Respiratoria (/min)</Label>
              <Input type="number" value={form.respiratory_rate} onChange={(e) => setForm({ ...form, respiratory_rate: e.target.value })} />
            </div>
            <div>
              <Label>Presión Arterial</Label>
              <Input value={form.blood_pressure} onChange={(e) => setForm({ ...form, blood_pressure: e.target.value })} placeholder="120/80" />
            </div>
            <div>
              <Label>Condición Corporal (1-9)</Label>
              <Input type="number" min="1" max="9" value={form.body_condition_score} onChange={(e) => setForm({ ...form, body_condition_score: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Notas Adicionales</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observaciones" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar Registro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
