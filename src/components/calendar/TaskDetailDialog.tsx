import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarTask } from "./calendarEvent";
import { TASK_TYPE_LABELS, STATUS_LABELS, type TaskType } from "@/lib/worker";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ClipboardList, User, MapPin, Dog, Clock, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface WelfareSummaryRow {
  dogName: string;
  present: boolean;
  flagLabels: string[];
}

/** Carga el resumen "X ok / Y con novedad" de una ronda de bienestar cerrada. */
function useWelfareCheckSummary(taskId: string | null, orgId: string | undefined, enabled: boolean) {
  const [rows, setRows] = useState<WelfareSummaryRow[] | null>(null);

  useEffect(() => {
    if (!enabled || !taskId || !orgId) { setRows(null); return; }
    let cancelled = false;
    (async () => {
      const [{ data: entries }, { data: items }] = await Promise.all([
        supabase
          .from("welfare_check_entries")
          .select("present, flags, dogs(name)")
          .eq("task_id", taskId),
        supabase.from("welfare_check_items").select("key, label").eq("organization_id", orgId),
      ]);
      if (cancelled) return;
      const labelByKey = new Map((items ?? []).map((i: any) => [i.key, i.label]));
      setRows(
        (entries ?? []).map((e: any) => ({
          dogName: e.dogs?.name ?? "Perro",
          present: e.present,
          flagLabels: Object.entries(e.flags ?? {})
            .filter(([, v]) => v)
            .map(([k]) => labelByKey.get(k) ?? k),
        }))
      );
    })();
    return () => { cancelled = true; };
  }, [taskId, orgId, enabled]);

  return rows;
}

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
  const { organization } = useOrganization();
  const isWelfareCheck = task?.type === "welfare_check";
  const isDone = task ? (statusBucket[task.status] ?? "pending") === "done" : false;
  const welfareRows = useWelfareCheckSummary(task?.id ?? null, organization?.id, open && isWelfareCheck && isDone);

  if (!task) return null;

  const noveltyCount = welfareRows?.filter((r) => !r.present || r.flagLabels.length > 0).length ?? 0;

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

          {isWelfareCheck && isDone ? (
            welfareRows === null ? (
              <p className="text-muted-foreground">Cargando resumen…</p>
            ) : (
              <div className="space-y-2">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  {welfareRows.length - noveltyCount} perro(s) sin novedad
                  {noveltyCount > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      · <AlertTriangle className="h-4 w-4" />{noveltyCount} con novedad
                    </span>
                  )}
                </p>
                {welfareRows.filter((r) => !r.present || r.flagLabels.length > 0).map((r, i) => (
                  <p key={i} className="text-xs text-muted-foreground pl-6">
                    {r.dogName}: {[!r.present ? "ausente" : null, ...r.flagLabels].filter(Boolean).join(", ")}
                  </p>
                ))}
              </div>
            )
          ) : (
            <>
              {task.dogName && (
                <p className="flex items-center gap-2"><Dog className="h-4 w-4 text-muted-foreground" />{task.dogName}</p>
              )}
            </>
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
