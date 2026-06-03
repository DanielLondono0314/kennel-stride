import { useMemo, useState } from "react";
import { useTasks } from "@/hooks/queries/useTasks";
import { usePermission } from "@/hooks/usePermission";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CardGridSkeleton } from "@/components/shared/TableSkeleton";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { Plus, ListTodo, Clock, Dog, MapPin, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  TASK_TYPE_LABELS,
  TASK_PRIORITY_LABELS,
  type TaskType,
  type TaskPriority,
} from "@/lib/worker";

type TaskStatus = "pending" | "in_progress" | "done" | "skipped";

const COLUMNS: { status: TaskStatus; label: string }[] = [
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

export default function TasksPage() {
  const { data, isLoading, isError, refetch } = useTasks();
  const canManage = usePermission("manage_tasks");
  const [modalOpen, setModalOpen] = useState(false);

  const tasks = (data ?? []) as any[];

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, any[]> = {
      pending: [],
      in_progress: [],
      done: [],
      skipped: [],
    };
    for (const t of tasks) {
      const bucket: TaskStatus = t.status === "skipped" ? "done" : (t.status as TaskStatus);
      (map[bucket] ?? map.pending).push(t);
    }
    return map;
  }, [tasks]);

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
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setModalOpen(true)} className="gap-2">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => (
            <div key={col.status} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  {col.label}
                </h2>
                <Badge variant="secondary">{grouped[col.status].length}</Badge>
              </div>

              {grouped[col.status].length === 0 ? (
                <p className="text-sm text-muted-foreground px-1 py-6 text-center">Sin tareas</p>
              ) : (
                grouped[col.status].map((t) => (
                  <Card key={t.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium leading-tight">{t.title}</h3>
                        <Badge variant={PRIORITY_VARIANT[t.priority as TaskPriority] ?? "default"} className="shrink-0 text-xs">
                          {TASK_PRIORITY_LABELS[t.priority as TaskPriority] ?? t.priority}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {TASK_TYPE_LABELS[t.type as TaskType] ?? t.type}
                      </p>

                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {t.dogs?.name && (
                          <span className="flex items-center gap-1.5"><Dog className="h-3.5 w-3.5" />{t.dogs.name}</span>
                        )}
                        {t.facility_zones?.name && (
                          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{t.facility_zones.name}</span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" />
                          {staffName(t.staff_members) ?? "Sin asignar"}
                        </span>
                        {t.due_at && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {format(new Date(t.due_at), "d MMM HH:mm", { locale: es })}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ))}
        </div>
      )}

      <TaskFormModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
