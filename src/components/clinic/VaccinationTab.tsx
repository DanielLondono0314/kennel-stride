import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
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
import { Plus, Syringe, CheckCircle, AlertTriangle, Clock, Pencil, Trash2 } from "lucide-react";
import { format, isPast, isFuture, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface Props { dogId: string; dogName: string; }

const vaccineTypes = [
  { value: "rabies", label: "Rabia" },
  { value: "dhpp", label: "DHPP (Moquillo, Hepatitis, Parvo, Parainfluenza)" },
  { value: "bordetella", label: "Bordetella (Tos de las Perreras)" },
  { value: "canine_influenza", label: "Influenza Canina" },
  { value: "leptospirosis", label: "Leptospirosis" },
  { value: "lyme", label: "Lyme" },
  { value: "coronavirus", label: "Coronavirus" },
  { value: "giardia", label: "Giardia" },
  { value: "other", label: "Otra" },
];

const emptyForm = { vaccine_name: "", vaccine_type: "core", date_administered: new Date().toISOString().split("T")[0], next_dose_date: "", batch_number: "", veterinarian: "", notes: "" };

export function VaccinationTab({ dogId, dogName }: Props) {
  const { organization } = useOrganization();
  const [records, setRecords] = useState<Tables<"vaccination_schedule">[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchRecords = async () => {
    setLoading(true);
    const { data } = await supabase.from("vaccination_schedule")
      .select("id, vaccine_name, vaccine_type, date_administered, next_dose_date, batch_number, veterinarian, notes, organization_id, status, created_at, dog_id, dog_name")
      .eq("dog_id", dogId).order("date_administered", { ascending: false });
    if (data) setRecords(data);
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, [dogId]);

  const openNew = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (r: Tables<"vaccination_schedule">) => {
    setEditingId(r.id);
    setForm({ vaccine_name: r.vaccine_name, vaccine_type: r.vaccine_type, date_administered: r.date_administered, next_dose_date: r.next_dose_date || "", batch_number: r.batch_number || "", veterinarian: r.veterinarian || "", notes: r.notes || "" });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.vaccine_name) { toast.error("Ingresa el nombre de la vacuna"); return; }
    if (!organization) { toast.error("Sin organización activa"); return; }
    const payload = { dog_id: dogId, dog_name: dogName, vaccine_name: form.vaccine_name, vaccine_type: form.vaccine_type, date_administered: form.date_administered, next_dose_date: form.next_dose_date || null, batch_number: form.batch_number, veterinarian: form.veterinarian, notes: form.notes, organization_id: organization.id };
    const { error } = editingId
      ? await supabase.from("vaccination_schedule").update(payload).eq("id", editingId).eq("organization_id", organization.id)
      : await supabase.from("vaccination_schedule").insert(payload);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success(editingId ? "Vacuna actualizada" : "Vacuna registrada");
    setModalOpen(false); fetchRecords();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    if (!organization) return;
    const { error } = await supabase.from("vaccination_schedule").delete().eq("id", deleteId).eq("organization_id", organization.id);
    if (!error) { toast.success("Vacuna eliminada"); fetchRecords(); }
    setDeleteId(null);
  };

  const getStatus = (r: Tables<"vaccination_schedule">) => {
    if (!r.next_dose_date) return { label: "Vigente", icon: CheckCircle, className: "bg-success/10 text-success" };
    const next = new Date(r.next_dose_date);
    if (isPast(next)) return { label: "Vencida", icon: AlertTriangle, className: "bg-destructive/10 text-destructive" };
    if (isFuture(next) && next <= addDays(new Date(), 30)) return { label: "Por vencer", icon: Clock, className: "bg-warning/10 text-warning" };
    return { label: "Vigente", icon: CheckCircle, className: "bg-success/10 text-success" };
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Esquema de Vacunación</h3>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1.5" /> Registrar Vacuna</Button>
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : records.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><Syringe className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No hay vacunas registradas.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {records.map((r) => {
            const status = getStatus(r);
            const StatusIcon = status.icon;
            return (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10"><Syringe className="h-5 w-5 text-primary" /></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground text-sm">{r.vaccine_name}</span>
                      <Badge className={status.className}><StatusIcon className="h-3 w-3 mr-1" />{status.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Aplicada: {format(new Date(r.date_administered), "dd MMM yyyy", { locale: es })}
                      {r.next_dose_date && ` · Próxima: ${format(new Date(r.next_dose_date), "dd MMM yyyy", { locale: es })}`}
                    </p>
                    {r.veterinarian && <p className="text-xs text-muted-foreground">Dr. {r.veterinarian}</p>}
                    {r.batch_number && <p className="text-xs text-muted-foreground">Lote: {r.batch_number}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)} aria-label="Editar registro"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(r.id)} aria-label="Eliminar registro"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar" : "Registrar"} Vacuna — {dogName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Vacuna</Label>
              <Select value={form.vaccine_name} onValueChange={(v) => setForm({ ...form, vaccine_name: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar vacuna" /></SelectTrigger>
                <SelectContent>{vaccineTypes.map((v) => (<SelectItem key={v.value} value={v.label}>{v.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tipo</Label>
                <Select value={form.vaccine_type} onValueChange={(v) => setForm({ ...form, vaccine_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="core">Esencial</SelectItem><SelectItem value="non_core">No Esencial</SelectItem><SelectItem value="booster">Refuerzo</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Lote</Label><Input value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} placeholder="Nro. de lote" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Fecha de Aplicación</Label><Input type="date" value={form.date_administered} onChange={(e) => setForm({ ...form, date_administered: e.target.value })} /></div>
              <div><Label>Próxima Dosis</Label><Input type="date" value={form.next_dose_date} onChange={(e) => setForm({ ...form, next_dose_date: e.target.value })} /></div>
            </div>
            <div><Label>Veterinario</Label><Input value={form.veterinarian} onChange={(e) => setForm({ ...form, veterinarian: e.target.value })} placeholder="Nombre del veterinario" /></div>
            <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observaciones" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button><Button onClick={handleSave}>{editingId ? "Actualizar" : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar vacuna?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
