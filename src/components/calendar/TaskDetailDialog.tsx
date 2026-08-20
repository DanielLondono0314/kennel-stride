import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarTask } from "./calendarEvent";
import { TASK_TYPE_LABELS, STATUS_LABELS, type TaskType } from "@/lib/worker";
import { ClipboardList, User, MapPin, Dog, Clock, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface TaskDetailDialogProps {
  task: CalendarTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewInTasks: () => void;
}

const statusBucket: Record<string, "pending" | "in_progress" | "done"> = {
  pending: "pending",
  in_progress: "in_progress",
  done: "done",
  skipped: "done",
};

/** Detalle de solo lectura de una tarea vista desde el calendario. Editar
 * se hace desde /tasks — TaskFormModal hoy solo soporta crear, no editar. */
export function TaskDetailDialog({ task, open, onOpenChange, onViewInTasks }: TaskDetailDialogProps) {
  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-accent" />
            {task.title}
          </DialogTitle>
          <DialogDescription>
            {TASK_TYPE_LABELS[task.type as TaskType] ?? task.type}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <Badge variant="secondary">{STATUS_LABELS[statusBucket[task.status] ?? "pending"]}</Badge>

          {task.dogName && (
            <p className="flex items-center gap-2"><Dog className="h-4 w-4 text-muted-foreground" />{task.dogName}</p>
          )}
          <p className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            {task.staffName ?? "Sin asignar"}
          </p>
          {task.zoneName && (
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{task.zoneName}</p>
          )}
          <p className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {format(new Date(task.dueAt), "PPP · HH:mm", { locale: es })}
          </p>
          {task.notes && (
            <p className="text-muted-foreground italic border-t pt-2">{task.notes}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={onViewInTasks} className="gap-1.5">
            <ExternalLink className="h-4 w-4" />Ver en Tareas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
