import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
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
import { Plus, AlertTriangle, CheckCircle, Activity, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface Props { dogId: string; dogName: string; }

const severityMap: Record<string, { label: string; className: string }> = {
  mild: { label: "Leve", className: "bg-info/10 text-info" },
  moderate: { label: "Moderada", className: "bg-warning/10 text-warning" },
  severe: { label: "Severa", className: "bg-destructive/10 text-destructive" },
};

const statusMap: Record<string, { label: string; className: string }> = {
  active: { label: "Activa", className: "bg-destructive/10 text-destructive" },
  chronic: { label: "Crónica", className: "bg-warning/10 text-warning" },
  resolved: { label: "Resuelta", className: "bg-success/10 text-success" },
  monitoring: { label: "En Observación", className: "bg-info/10 text-info" },
};

const emptyForm = { condition_name: "", condition_type: "disease", diagnosed_date: new Date().toISOString().split("T")[0], status: "active", severity: "moderate", treatment: "", notes: "" };

export function ConditionsTab({ dogId, dogName }: Props) {
  const { organization } = useOrganization();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchRecords = async () => {
    setLoading(true);
    const { data } = await supabase.from("medical_conditions").select("*").eq("dog_id", dogId).order("diagnosed_date", { ascending: false });
    if (data) setRecords(data);
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, [dogId]);

  const openNew = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (r: any) => {
    setEditingId(r.id);
    setForm({ condition_name: r.condition_name, condition_type: r.condition_type, diagnosed_date: r.diagnosed_date, status: r.status, severity: r.severity, treatment: r.treatment || "", notes: r.notes || "" });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.condition_name) { toast.error("Ingresa el nombre de la condición"); return; }
    if (!organization) { toast.error("Sin organización activa"); return; }
    const payload = { dog_id: dogId, dog_name: dogName, condition_name: form.condition_name, condition_type: form.condition_type, diagnosed_date: form.diagnosed_date, status: form.status, severity: form.severity, treatment: form.treatment, notes: form.notes, updated_at: new Date().toISOString(), organization_id: organization.id };
    const { error } = editingId
      ? await supabase.from("medical_conditions").update(payload).eq("id", editingId)
      : await supabase.from("medical_conditions").insert(payload);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success(editingId ? "Condición actualizada" : "Condición registrada");
    setModalOpen(false); fetchRecords();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("medical_conditions").delete().eq("id", deleteId);
    if (!error) { toast.success("Condición eliminada"); fetchRecords(); }
    setDeleteId(null);
  };

  const handleResolve = async (id: string) => {
    const { error } = await supabase.from("medical_conditions").update({ status: "resolved", resolved_date: new Date().toISOString().split("T")[0], updated_at: new Date().toISOString() }).eq("id", id);
    if (!error) { toast.success("Condición marcada como resuelta"); fetchRecords(); }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Condiciones Médicas</h3>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1.5" /> Registrar</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : records.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No hay condiciones médicas registradas.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{r.condition_name}</span>
                    <Badge className={statusMap[r.status]?.className || "bg-muted"}>{statusMap[r.status]?.label || r.status}</Badge>
                    <Badge className={severityMap[r.severity]?.className || "bg-muted"}>{severityMap[r.severity]?.label || r.severity}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {r.status !== "resolved" && (
                      <Button variant="ghost" size="sm" onClick={() => handleResolve(r.id)} className="text-success hover:text-success">
                        <CheckCircle className="h-4 w-4 mr-1" /> Resolver
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  Diagnosticada: {format(new Date(r.diagnosed_date), "dd MMM yyyy", { locale: es })}
                  {r.resolved_date && ` · Resuelta: ${format(new Date(r.resolved_date), "dd MMM yyyy", { locale: es })}`}
                </p>
                {r.treatment && <p className="text-sm text-muted-foreground">Tratamiento: {r.treatment}</p>}
                {r.notes && <p className="text-sm text-muted-foreground mt-1">{r.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar" : "Registrar"} Condición — {dogName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Condición / Enfermedad</Label><Input value={form.condition_name} onChange={(e) => setForm({ ...form, condition_name: e.target.value })} placeholder="Nombre de la condición" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Tipo</Label>
                <Select value={form.condition_type} onValueChange={(v) => setForm({ ...form, condition_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="disease">Enfermedad</SelectItem><SelectItem value="allergy">Alergia</SelectItem><SelectItem value="injury">Lesión</SelectItem><SelectItem value="congenital">Congénita</SelectItem><SelectItem value="chronic">Crónica</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Severidad</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="mild">Leve</SelectItem><SelectItem value="moderate">Moderada</SelectItem><SelectItem value="severe">Severa</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Activa</SelectItem><SelectItem value="chronic">Crónica</SelectItem><SelectItem value="monitoring">En Observación</SelectItem><SelectItem value="resolved">Resuelta</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Fecha de Diagnóstico</Label><Input type="date" value={form.diagnosed_date} onChange={(e) => setForm({ ...form, diagnosed_date: e.target.value })} /></div>
            <div><Label>Tratamiento</Label><Textarea value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} placeholder="Tratamiento indicado" /></div>
            <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observaciones adicionales" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button><Button onClick={handleSave}>{editingId ? "Actualizar" : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar condición?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
