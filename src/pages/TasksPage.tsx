import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTasks, useUpdateTask, useDeleteTask } from "@/hooks/queries/useTasks";
import { usePermission } from "@/hooks/usePermission";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";
import { TaskDetailDialog, isTaskOverdue, type TaskStatus } from "@/components/tasks/TaskDetailDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CardGridSkeleton } from "@/components/shared/TableSkeleton";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, ListTodo, Clock, Dog, MapPin, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  TASK_TYPE_LABELS,
  TASK_PRIORITY_LABELS,
  type TaskType,
  type TaskPriority,
} from "@/lib/worker";

type Column = "pending" | "in_progress" | "done";

const COLUMNS: { status: Column; label: string }[] = [
  { status: "pending", label: "Pendiente" },
  { status: "in_progress", label: "En curso" },
  { status: "done", label: "Hecho" },
];

const PRIORITY_VARIANT: Record<TaskPriority, "secondary" | "default" | "destructive"> = {
  low: "secondary",
  normal: "default",
  high: "destructive",
};

function staffName(s: any): string | null {
  if (!s) return null;
  return `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || null;
}

/** Campos a actualizar al mover una tarea de estado. */
function statusPatch(status: TaskStatus) {
  const done = status === "done" || status === "skipped";
  return {
    status,
    completed_at: done ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
}

export default function TasksPage() {
  const { data, isLoading, isError, refetch } = useTasks();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const canManage = usePermission("schedule");
  const [searchParams, setSearchParams] = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragOver, setDragOver] = useState<Column | null>(null);

  // ?assignee=<staff id>: tareas de un empleado (enlace desde Personal y Reportes — QA E-27).
  const assigneeFilter = searchParams.get("assignee");
  const tasks = useMemo(
    () => (data ?? []).filter((t) => !assigneeFilter || t.assignee_staff_id === assigneeFilter),
    [data, assigneeFilter]
  );
  const assigneeName = useMemo(() => {
    if (!assigneeFilter) return null;
    const t = (data ?? []).find((x) => x.assignee_staff_id === assigneeFilter);
    return t ? staffName(t.staff_members) : null;
  }, [data, assigneeFilter]);
  const clearAssignee = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("assignee");
    setSearchParams(next, { replace: true });
  };

  // La tarea abierta vive en la URL (?task=<id>): se puede enlazar desde el
  // Calendario u otras pantallas y abrir directo esa tarea.
  const openId = searchParams.get("task");
  const openTask = useMemo(() => (data ?? []).find((t) => t.id === openId) ?? null, [data, openId]);

  const setOpenId = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("task", id);
    else next.delete("task");
    setSearchParams(next, { replace: true });
  };

  // Enlace a una tarea que ya no existe: se limpia el parámetro.
  useEffect(() => {
    if (openId && !isLoading && data && !openTask) {
      toast.error("La tarea no existe o fue eliminada");
      setOpenId(null);
    }
  }, [openId, isLoading, data, openTask]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const map: Record<Column, any[]> = { pending: [], in_progress: [], done: [] };
    for (const t of tasks) {
      const bucket: Column = t.status === "skipped" ? "done" : (t.status as Column);
      (map[bucket] ?? map.pending).push(t);
    }
    // Hechas: las más recientes primero.
    map.done.sort((a, b) => (b.completed_at ?? b.updated_at ?? "").localeCompare(a.completed_at ?? a.updated_at ?? ""));
    return map;
  }, [tasks]);

  const overdueCount = useMemo(() => tasks.filter((t) => isTaskOverdue(t)).length, [tasks]);

  async function changeStatus(task: any, status: TaskStatus) {
    if (task.status === status) return;
    try {
      await updateTask.mutateAsync({ id: task.id, patch: statusPatch(status) });
    } catch (e) {
      toast.error("No se pudo cambiar el estado", { description: e instanceof Error ? e.message : undefined });
    }
  }

  async function handleDelete() {
    if (!openTask) return;
    try {
      await deleteTask.mutateAsync(openTask.id);
      toast.success("Tarea eliminada");
      setConfirmDelete(false);
      setOpenId(null);
    } catch (e) {
      toast.error("No se pudo eliminar la tarea", { description: e instanceof Error ? e.message : undefined });
    }
  }

  function onDrop(e: React.DragEvent, col: Column) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/task-id");
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const current = (task.status === "skipped" ? "done" : task.status) as Column;
    if (current !== col) changeStatus(task, col);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-accent" />
            Tareas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tasks.length} tareas · {grouped.pending.length} pendientes
            {overdueCount > 0 && <span className="text-destructive font-medium"> · {overdueCount} vencidas</span>}
          </p>
          {assigneeFilter && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs">
              <User className="h-3.5 w-3.5" aria-hidden />
              Asignadas a {assigneeName ?? "este empleado"}
              <button type="button" onClick={clearAssignee} className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
                Ver todas
              </button>
            </div>
          )}
        </div>
        {canManage && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva tarea
          </Button>
        )}
      </div>

      {isError ? (
        <QueryErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <CardGridSkeleton count={6} />
      ) : (
        <>
          <p className="text-xs text-muted-foreground hidden md:block">
            Abre una tarea para cambiar su estado, o arrástrala a otra columna.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMNS.map((col) => (
              <section
                key={col.status}
                aria-labelledby={`col-${col.status}`}
                className={cn(
                  "space-y-3 rounded-lg p-1 transition-colors",
                  dragOver === col.status && "bg-primary/5 ring-2 ring-primary/30"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.status); }}
                onDragLeave={() => setDragOver((c) => (c === col.status ? null : c))}
                onDrop={(e) => onDrop(e, col.status)}
              >
                <div className="flex items-center justify-between px-1">
                  <h2 id={`col-${col.status}`} className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                    {col.label}
                  </h2>
                  <Badge variant="secondary">{grouped[col.status].length}</Badge>
                </div>

                {grouped[col.status].length === 0 ? (
                  <p className="text-sm text-muted-foreground px-1 py-6 text-center">Sin tareas</p>
                ) : (
                  grouped[col.status].map((t) => {
                    const overdue = isTaskOverdue(t);
                    return (
                      <Card
                        key={t.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/task-id", t.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        className={cn(
                          "cursor-pointer transition-shadow hover:shadow-md",
                          overdue && "border-destructive/50",
                          t.status === "skipped" && "opacity-70"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenId(t.id)}
                          className="block w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-medium leading-tight">{t.title}</h3>
                              <Badge variant={PRIORITY_VARIANT[t.priority as TaskPriority] ?? "default"} className="shrink-0 text-xs">
                                {TASK_PRIORITY_LABELS[t.priority as TaskPriority] ?? t.priority}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <span>{TASK_TYPE_LABELS[t.type as TaskType] ?? t.type}</span>
                              {overdue && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Vencida</Badge>}
                              {t.status === "skipped" && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Omitida</Badge>}
                            </div>

                            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                              {t.dogs?.name && (
                                <span className="flex items-center gap-1.5"><Dog className="h-3.5 w-3.5" aria-hidden />{t.dogs.name}</span>
                              )}
                              {t.facility_zones?.name && (
                                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden />{t.facility_zones.name}</span>
                              )}
                              <span className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" aria-hidden />
                                {staffName(t.staff_members) ?? "Sin asignar"}
                              </span>
                              {t.due_at && (
                                <span className={cn("flex items-center gap-1.5", overdue && "text-destructive")}>
                                  <Clock className="h-3.5 w-3.5" aria-hidden />
                                  {format(new Date(t.due_at), "d MMM HH:mm", { locale: es })}
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </button>
                      </Card>
                    );
                  })
                )}
              </section>
            ))}
          </div>
        </>
      )}

      <TaskDetailDialog
        task={openTask}
        open={!!openTask && !formOpen}
        onOpenChange={(o) => !o && setOpenId(null)}
        canManage={canManage}
        busy={updateTask.isPending || deleteTask.isPending}
        onChangeStatus={(s) => openTask && changeStatus(openTask, s)}
        onEdit={() => { setEditing(openTask); setFormOpen(true); }}
        onDelete={() => setConfirmDelete(true)}
      />

      <TaskFormModal open={formOpen} onOpenChange={setFormOpen} task={editing} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra también su reporte. Si solo no se hizo, mejor márcala como "Omitir" para que quede en el historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
