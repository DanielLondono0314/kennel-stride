import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/shared/TableSkeleton";
import { Card, CardContent } from "@/components/ui/card";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, FileText, Thermometer, Heart, Weight, Calendar, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface Props { dogId: string; dogName: string; }

const recordTypes: Record<string, { label: string; color: string }> = {
  consultation: { label: "Consulta", color: "bg-info/10 text-info" },
  surgery: { label: "Cirugía", color: "bg-destructive/10 text-destructive" },
  emergency: { label: "Emergencia", color: "bg-destructive/10 text-destructive" },
  checkup: { label: "Chequeo", color: "bg-success/10 text-success" },
  dental: { label: "Dental", color: "bg-warning/10 text-warning" },
  laboratory: { label: "Laboratorio", color: "bg-primary/10 text-primary" },
  imaging: { label: "Imagen", color: "bg-primary/10 text-primary" },
};

const emptyForm = {
  record_date: new Date().toISOString().split("T")[0],
  record_type: "consultation", veterinarian: "", reason: "", diagnosis: "",
  treatment: "", prescription: "", weight: "", temperature: "", heart_rate: "",
  respiratory_rate: "", blood_pressure: "", body_condition_score: "", notes: "", next_appointment: "",
};

export function MedicalHistoryTab({ dogId, dogName }: Props) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { organization } = useOrganization();

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("medical_history").select("*").eq("dog_id", dogId).order("record_date", { ascending: false });
    if (data) setRecords(data);
    setLoading(false);
  }, [dogId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const openNew = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      record_date: r.record_date, record_type: r.record_type, veterinarian: r.veterinarian || "",
      reason: r.reason || "", diagnosis: r.diagnosis || "", treatment: r.treatment || "",
      prescription: r.prescription || "", weight: r.weight?.toString() || "", temperature: r.temperature?.toString() || "",
      heart_rate: r.heart_rate?.toString() || "", respiratory_rate: r.respiratory_rate?.toString() || "",
      blood_pressure: r.blood_pressure || "", body_condition_score: r.body_condition_score?.toString() || "",
      notes: r.notes || "", next_appointment: r.next_appointment || "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!organization) {
      toast.error("Organización no cargada, intenta de nuevo");
      return;
    }
    const payload = {
      dog_id: dogId,
      dog_name: dogName,
      organization_id: organization.id,
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
      updated_at: new Date().toISOString(),
    };
    const { error } = editingId
      ? await supabase.from("medical_history").update(payload).eq("id", editingId).eq("organization_id", organization.id)
      : await supabase.from("medical_history").insert(payload);
    if (error) {
      toast.error(`Error al guardar: ${error.message}`);
      return;
    }
    toast.success(editingId ? "Registro actualizado" : "Registro guardado");
    setModalOpen(false);
    fetchRecords();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    if (!organization) return;
    const { error } = await supabase.from("medical_history").delete().eq("id", deleteId).eq("organization_id", organization.id);
    if (!error) { toast.success("Registro eliminado"); fetchRecords(); }
    setDeleteId(null);
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Historial Médico</h3>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1.5" /> Nueva Consulta</Button>
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : records.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No hay registros médicos aún.</p></CardContent></Card>
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
                    <span className="text-sm text-muted-foreground">{format(new Date(r.record_date), "dd MMM yyyy", { locale: es })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {r.veterinarian && <span className="text-xs text-muted-foreground mr-2">Dr. {r.veterinarian}</span>}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)} aria-label="Editar registro"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(r.id)} aria-label="Eliminar registro"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {r.reason && <p className="text-sm font-medium text-foreground mb-1">Motivo: {r.reason}</p>}
                {r.diagnosis && <p className="text-sm text-foreground mb-1">Diagnóstico: {r.diagnosis}</p>}
                {r.treatment && <p className="text-sm text-muted-foreground mb-1">Tratamiento: {r.treatment}</p>}
                {r.prescription && <p className="text-sm text-muted-foreground mb-1">Prescripción: {r.prescription}</p>}
                <div className="flex flex-wrap gap-3 mt-2">
                  {r.weight && <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded"><Weight className="h-3 w-3" /> {r.weight} kg</span>}
                  {r.temperature && <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded"><Thermometer className="h-3 w-3" /> {r.temperature}°C</span>}
                  {r.heart_rate && <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded"><Heart className="h-3 w-3" /> {r.heart_rate} bpm</span>}
                  {r.respiratory_rate && <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Resp: {r.respiratory_rate}/min</span>}
                  {r.blood_pressure && <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">PA: {r.blood_pressure}</span>}
                </div>
                {r.next_appointment && (
                  <p className="text-xs text-info mt-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />Próxima cita: {format(new Date(r.next_appointment), "dd MMM yyyy", { locale: es })}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar" : "Nuevo"} Registro Médico — {dogName}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Fecha</Label><Input type="date" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} /></div>
            <div><Label>Tipo de Registro</Label>
              <Select value={form.record_type} onValueChange={(v) => setForm({ ...form, record_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(recordTypes).map(([k, v]) => (<SelectItem key={k} value={k}>{v.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div><Label>Veterinario</Label><Input value={form.veterinarian} onChange={(e) => setForm({ ...form, veterinarian: e.target.value })} placeholder="Nombre del veterinario" /></div>
            <div><Label>Próxima Cita</Label><Input type="date" value={form.next_appointment} onChange={(e) => setForm({ ...form, next_appointment: e.target.value })} /></div>
            <div className="col-span-2"><Label>Motivo de Consulta</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Razón de la visita" /></div>
            <div className="col-span-2"><Label>Diagnóstico</Label><Textarea value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="Diagnóstico" /></div>
            <div className="col-span-2"><Label>Tratamiento</Label><Textarea value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} placeholder="Tratamiento indicado" /></div>
            <div className="col-span-2"><Label>Prescripción</Label><Textarea value={form.prescription} onChange={(e) => setForm({ ...form, prescription: e.target.value })} placeholder="Medicamentos prescritos" /></div>
            <p className="col-span-2 text-sm font-semibold text-foreground mt-2">Signos Vitales</p>
            <div><Label>Peso (kg)</Label><Input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></div>
            <div><Label>Temperatura (°C)</Label><Input type="number" step="0.1" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} /></div>
            <div><Label>Frec. Cardíaca (bpm)</Label><Input type="number" value={form.heart_rate} onChange={(e) => setForm({ ...form, heart_rate: e.target.value })} /></div>
            <div><Label>Frec. Respiratoria (/min)</Label><Input type="number" value={form.respiratory_rate} onChange={(e) => setForm({ ...form, respiratory_rate: e.target.value })} /></div>
            <div><Label>Presión Arterial</Label><Input value={form.blood_pressure} onChange={(e) => setForm({ ...form, blood_pressure: e.target.value })} placeholder="120/80" /></div>
            <div><Label>Condición Corporal (1-9)</Label><Input type="number" min="1" max="9" value={form.body_condition_score} onChange={(e) => setForm({ ...form, body_condition_score: e.target.value })} /></div>
            <div className="col-span-2"><Label>Notas Adicionales</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observaciones" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? "Actualizar" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
