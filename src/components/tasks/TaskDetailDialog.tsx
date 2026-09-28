import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Circle, Clock, Dog, Loader2, MapPin, Pencil, PlayCircle, SkipForward, Trash2, User } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";
import { cn } from "@/lib/utils";
import { TASK_PRIORITY_LABELS, TASK_TYPE_LABELS, type TaskPriority, type TaskType } from "@/lib/worker";

export type TaskStatus = "pending" | "in_progress" | "done" | "skipped";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  done: "Hecha",
  skipped: "Omitida",
};

/** Vencida = tiene fecha límite pasada y sigue abierta. */
export function isTaskOverdue(t: { status: string; due_at: string | null }, now = new Date()): boolean {
  return !!t.due_at && (t.status === "pending" || t.status === "in_progress") && new Date(t.due_at) < now;
}

const STATUS_ACTIONS: { status: TaskStatus; label: string; icon: typeof Circle }[] = [
  { status: "pending", label: "Pendiente", icon: Circle },
  { status: "in_progress", label: "En curso", icon: PlayCircle },
  { status: "done", label: "Hecha", icon: CheckCircle2 },
  { status: "skipped", label: "Omitir", icon: SkipForward },
];

interface TaskDetailDialogProps {
  task: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  busy: boolean;
  onChangeStatus: (status: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function TaskDetailDialog({ task, open, onOpenChange, canManage, busy, onChangeStatus, onEdit, onDelete }: TaskDetailDialogProps) {
  const base = useOrgBasePath();
  if (!task) return null;

  const status = task.status as TaskStatus;
  const overdue = isTaskOverdue(task);
  const assignee = task.staff_members
    ? `${task.staff_members.first_name ?? ""} ${task.staff_members.last_name ?? ""}`.trim()
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6">{task.title}</DialogTitle>
          <DialogDescription>
            {TASK_TYPE_LABELS[task.type as TaskType] ?? task.type}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Badge variant={status === "done" ? "default" : "secondary"}>{TASK_STATUS_LABELS[status] ?? status}</Badge>
          <Badge variant="outline">Prioridad {TASK_PRIORITY_LABELS[task.priority as TaskPriority]?.toLowerCase() ?? task.priority}</Badge>
          {overdue && <Badge variant="destructive">Vencida</Badge>}
        </div>

        <dl className="grid gap-2 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Asignada a</dt>
            <dd>{assignee || "Sin asignar"}</dd>
          </div>
          {task.dogs?.name && (
            <div className="flex items-center gap-2">
              <Dog className="h-4 w-4 text-muted-foreground" aria-hidden />
              <dt className="sr-only">Perro</dt>
              <dd>
                <Link to={`${base}/dogs/${task.dogs.id}`} className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">{task.dogs.name}</Link>
              </dd>
            </div>
          )}
          {task.facility_zones?.name && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
              <dt className="sr-only">Zona</dt>
              <dd>{task.facility_zones.name}</dd>
            </div>
          )}
          {task.due_at && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
              <dt className="sr-only">Vence</dt>
              <dd className={cn(overdue && "text-destructive font-medium")}>
                {format(new Date(task.due_at), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
              </dd>
            </div>
          )}
          {task.completed_at && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              <dt className="sr-only">Completada</dt>
              <dd>Completada el {format(new Date(task.completed_at), "d MMM yyyy, HH:mm", { locale: es })}</dd>
            </div>
          )}
        </dl>

        {task.notes && (
          <div>
            <h3 className="text-sm font-semibold mb-1">Notas</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.notes}</p>
          </div>
        )}

        {task.photos?.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {task.photos.map((url: string, i: number) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={`Foto ${i + 1} del reporte`} className="aspect-square w-full rounded object-cover border" loading="lazy" />
              </a>
            ))}
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold mb-2">Cambiar estado</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Estado de la tarea">
            {STATUS_ACTIONS.map((a) => (
              <Button
                key={a.status}
                type="button"
                size="sm"
                variant={status === a.status ? "default" : "outline"}
                aria-pressed={status === a.status}
                disabled={busy || status === a.status}
                onClick={() => onChangeStatus(a.status)}
                className="gap-1.5"
              >
                <a.icon className="h-4 w-4" aria-hidden />
                {a.label}
              </Button>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {canManage ? (
            <Button variant="ghost" onClick={onDelete} disabled={busy} className="gap-1.5 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" /> Eliminar
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" aria-label="Guardando" />}
            {canManage && (
              <Button variant="outline" onClick={onEdit} disabled={busy} className="gap-1.5">
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
