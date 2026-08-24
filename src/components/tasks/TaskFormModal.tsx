import { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useCreateTask } from "@/hooks/queries/useTasks";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDraftForm } from "@/hooks/useDraftForm";
import { DraftBanner } from "@/components/shared/DraftBanner";
import {
  TASK_TYPES,
  TASK_TYPE_LABELS,
  TASK_TYPE_BY_SPECIALTY,
  TASK_PRIORITY_LABELS,
  SPECIALTY_LABELS,
  type TaskType,
  type TaskPriority,
  type Specialty,
} from "@/lib/worker";

const taskSchema = z.object({
  type: z.enum(["cleaning", "feeding", "walk", "vet_check", "grooming", "other"]),
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  dog_id: z.string().uuid().nullable(),
  zone_id: z.string().uuid().nullable(),
  assignee_staff_id: z.string().uuid().nullable(),
  due_at: z.string().nullable(),
  priority: z.enum(["low", "normal", "high"]),
});

interface TaskFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

interface WorkerStaff {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string | null;
}
interface NamedRow {
  id: string;
  name: string;
}

const NONE = "__none__";

export function TaskFormModal({ open, onOpenChange, onSaved }: TaskFormModalProps) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const createTask = useCreateTask();

  const [type, setType] = useState<TaskType>("cleaning");
  const [title, setTitle] = useState("");
  const [dogId, setDogId] = useState<string>(NONE);
  const [zoneId, setZoneId] = useState<string>(NONE);
  const [assigneeId, setAssigneeId] = useState<string>(NONE);
  const [dueAt, setDueAt] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("normal");

  const [workers, setWorkers] = useState<WorkerStaff[]>([]);
  const [dogs, setDogs] = useState<NamedRow[]>([]);
  const [zones, setZones] = useState<NamedRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !orgId) return;
    setType("cleaning");
    setTitle("");
    setDogId(NONE);
    setZoneId(NONE);
    setAssigneeId(NONE);
    setDueAt("");
    setPriority("normal");

    supabase
      .from("staff_members")
      .select("id, first_name, last_name, specialty")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .eq("role", "worker")
      .order("first_name")
      .then(({ data }) => { if (data) setWorkers(data as WorkerStaff[]); });

    supabase
      .from("dogs")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name")
      .then(({ data }) => { if (data) setDogs(data as NamedRow[]); });

    supabase
      .from("facility_zones")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name")
      .then(({ data }) => { if (data) setZones(data as NamedRow[]); });
  }, [open, orgId]);

  // Borrador local: si cierran el modal sin guardar (cambio de pestaña/app,
  // Escape, clic afuera), no se pierde lo llenado.
  const draftKey = orgId ? `taskDraft:${orgId}:new` : null;
  const draftValue = { type, title, dogId, zoneId, assigneeId, dueAt, priority };
  const { hasDraft, clearDraft } = useDraftForm({
    key: draftKey,
    active: open,
    value: draftValue,
    apply: (d) => {
      setType(d.type); setTitle(d.title ?? "");
      setDogId(d.dogId ?? NONE); setZoneId(d.zoneId ?? NONE); setAssigneeId(d.assigneeId ?? NONE);
      setDueAt(d.dueAt ?? ""); setPriority(d.priority ?? "normal");
    },
    isEmpty: (v) => !v.title.trim() && v.dogId === NONE && v.zoneId === NONE && v.assigneeId === NONE && !v.dueAt,
  });

  const discardDraft = () => {
    clearDraft();
    setType("cleaning"); setTitle(""); setDogId(NONE); setZoneId(NONE);
    setAssigneeId(NONE); setDueAt(""); setPriority("normal");
  };

  // Specialty-aware task type options: when an assignee with a specialty is chosen,
  // restrict the selectable task types to that specialty's allowed set.
  const selectedWorker = workers.find((w) => w.id === assigneeId);
  const typeOptions = useMemo<TaskType[]>(() => {
    const specialty = selectedWorker?.specialty as Specialty | undefined;
    if (specialty && TASK_TYPE_BY_SPECIALTY[specialty]) {
      return TASK_TYPE_BY_SPECIALTY[specialty];
    }
    return TASK_TYPES;
  }, [selectedWorker?.specialty]);

  useEffect(() => {
    if (!typeOptions.includes(type)) setType(typeOptions[0]);
  }, [typeOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    const parsed = taskSchema.safeParse({
      type,
      title,
      dog_id: dogId === NONE ? null : dogId,
      zone_id: zoneId === NONE ? null : zoneId,
      assignee_staff_id: assigneeId === NONE ? null : assigneeId,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      priority,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }

    setSaving(true);
    try {
      await createTask.mutateAsync(parsed.data);
      toast.success("Tarea creada");
      clearDraft();
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message ?? "Error creando la tarea");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
          {hasDraft && <DraftBanner onDiscard={discardDraft} />}
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Aseo zona A, paseo matutino…"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Asignar a</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin asignar</SelectItem>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.first_name} {w.last_name}
                      {w.specialty ? ` · ${SPECIALTY_LABELS[w.specialty as Specialty] ?? w.specialty}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typeOptions.map((t) => (
                    <SelectItem key={t} value={t}>{TASK_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Perro</Label>
              <Select value={dogId} onValueChange={setDogId}>
                <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Ninguno</SelectItem>
                  {dogs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Zona</Label>
              <Select value={zoneId} onValueChange={setZoneId}>
                <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Ninguna</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vencimiento</Label>
              <Input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Crear tarea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
