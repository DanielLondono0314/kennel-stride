import { useMemo, useState } from "react";
import {
  useDogWeightLog, useAddWeightLog, useDeleteWeightLog, type WeightEntry,
} from "@/hooks/queries/useDogWeightLog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ListSkeleton } from "@/components/shared/TableSkeleton";
import { Plus, Scale, Trash2, Stethoscope } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface Props { dogId: string; dogName: string; }

const emptyForm = { weight: "", recorded_at: new Date().toISOString().split("T")[0], notes: "" };

export function WeightTab({ dogId, dogName }: Props) {
  const { data: entries = [], isLoading } = useDogWeightLog(dogId);
  const addLog = useAddWeightLog(dogId);
  const deleteLog = useDeleteWeightLog(dogId);

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const chartData = useMemo(
    () => entries.map((e) => ({ date: format(new Date(e.date), "d MMM", { locale: es }), peso: e.weight })),
    [entries]
  );

  const openNew = () => { setForm(emptyForm); setModalOpen(true); };

  const handleSave = async () => {
    const weight = parseFloat(form.weight);
    if (!form.weight || Number.isNaN(weight) || weight <= 0) {
      toast.error("Ingresa un peso válido");
      return;
    }
    try {
      await addLog.mutateAsync({ weight, recorded_at: form.recorded_at, notes: form.notes });
      toast.success("Peso registrado");
      setModalOpen(false);
    } catch {
      toast.error("No se pudo guardar", { description: "Revisa tu conexión e inténtalo de nuevo." });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteLog.mutateAsync(deleteId);
      toast.success("Registro eliminado");
    } catch {
      toast.error("No se pudo eliminar", { description: "Inténtalo de nuevo." });
    }
    setDeleteId(null);
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Hoja de Pesos</h3>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1.5" /> Registrar peso</Button>
      </div>

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : entries.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><Scale className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">Sin pesos registrados aún.</p></CardContent></Card>
      ) : (
        <>
          <Card>
            <CardContent className="pt-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit=" kg" width={56} />
                    <Tooltip formatter={(v: number) => [`${v} kg`, "Peso"]} />
                    <Line type="monotone" dataKey="peso" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {[...entries].reverse().map((e: WeightEntry) => (
              <Card key={`${e.source}-${e.id}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/10 shrink-0">
                    {e.source === "medical" ? <Stethoscope className="h-4 w-4 text-accent-foreground" /> : <Scale className="h-4 w-4 text-accent-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{e.weight} kg</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(e.date), "d MMM yyyy", { locale: es })}</span>
                      {e.source === "medical" && <Badge variant="outline" className="text-[10px]">Historial Médico</Badge>}
                    </div>
                    {e.notes && e.source === "log" && <p className="text-xs text-muted-foreground truncate">{e.notes}</p>}
                  </div>
                  {e.source === "log" && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => setDeleteId(e.id)} aria-label="Eliminar registro">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Peso — {dogName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Peso (kg)</Label><Input type="number" step="0.1" min="0" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="0.0" /></div>
              <div><Label>Fecha</Label><Input type="date" value={form.recorded_at} onChange={(e) => setForm({ ...form, recorded_at: e.target.value })} /></div>
            </div>
            <div><Label>Notas (opcional)</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observaciones" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={addLog.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar registro de peso?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
