import { Link } from "react-router-dom";
import { format, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronRight, ClipboardList, Clock, Dog, Home } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyDay, type FeedItem } from "@/hooks/queries/useMyDay";
import { useMyStaffMember } from "@/hooks/useMyStaffMember";
import { useWorkerDogs } from "@/hooks/queries/useWorkerDogs";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";
import { STATUS_LABELS } from "@/lib/worker";
import { cn } from "@/lib/utils";
import { DogAlertChips, DogAvatar } from "@/components/worker/dogs/DogBits";

const BUCKETS = ["in_progress", "pending", "done"] as const;

function isOverdue(item: FeedItem) {
  return item.bucket !== "done" && !!item.time && new Date(item.time) < new Date() && !isToday(new Date(item.time));
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

export default function MyDayPage() {
  const base = useOrgBasePath();
  const { data = [], isLoading } = useMyDay();
  const { data: staff } = useMyStaffMember();
  const { data: dogs = [] } = useWorkerDogs();

  const inCenter = dogs.filter((d) => d.inCenter);
  const withAlerts = inCenter.filter((d) => d.flags.aggressive || d.flags.allergies || d.flags.medication).length;
  const counts = {
    pending: data.filter((i) => i.bucket === "pending").length,
    in_progress: data.filter((i) => i.bucket === "in_progress").length,
    done: data.filter((i) => i.bucket === "done").length,
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted-foreground first-letter:uppercase">
          {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
        </p>
        <h1 className="text-xl font-semibold">
          {greeting()}{staff?.first_name ? `, ${staff.first_name}` : ""}
        </h1>
      </header>

      {/* Resumen del día */}
      <div className="grid grid-cols-3 gap-2">
        {([["pending", "Pendientes"], ["in_progress", "En curso"], ["done", "Hechas"]] as const).map(([k, label]) => (
          <div key={k} className="rounded-lg border bg-card p-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{counts[k]}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Acceso a los perros presentes */}
      <Link
        to={`${base}/worker/dogs`}
        className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/40"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Dog className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="flex-1">
          <p className="font-medium">{inCenter.length} {inCenter.length === 1 ? "perro" : "perros"} en el centro</p>
          <p className="text-xs text-muted-foreground">
            {withAlerts > 0 ? `${withAlerts} con alertas de cuidado · ` : ""}Ver fichas, alimentación y medicación
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
      </Link>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10 mb-2 opacity-50" aria-hidden />
          <p className="font-medium text-foreground">No tienes trabajo asignado hoy</p>
          <p className="text-sm">Cuando te asignen tareas o reservas aparecerán aquí.</p>
        </div>
      ) : (
        BUCKETS.map((b) => {
          const items = data.filter((i) => i.bucket === b);
          if (items.length === 0) return null;
          return (
            <section key={b} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {STATUS_LABELS[b]} ({items.length})
              </h2>
              {items.map((item) => {
                const overdue = isOverdue(item);
                return (
                  <Link
                    key={`${item.kind}-${item.id}`}
                    to={`${base}/worker/${item.kind}/${item.id}`}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      overdue && "border-destructive/50",
                      b === "done" && "opacity-70"
                    )}
                  >
                    {item.dogName ? (
                      <DogAvatar photoUrl={item.dogPhotoUrl} name={item.dogName} />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden>
                        <ClipboardList className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-semibold">{item.dogName ?? item.title}</p>
                        {item.time && (
                          <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                            <Clock className="h-3 w-3" aria-hidden />
                            {overdue
                              ? `Atrasada · ${format(new Date(item.time), "d MMM", { locale: es })}`
                              : format(new Date(item.time), "HH:mm")}
                          </span>
                        )}
                      </div>
                      <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {item.dogName && <span className="truncate">{item.title}</span>}
                        {item.dogName && item.kennelName && <span aria-hidden>·</span>}
                        {item.kennelName && (
                          <span className="inline-flex shrink-0 items-center gap-1">
                            <Home className="h-3 w-3" aria-hidden /> {item.kennelName}
                          </span>
                        )}
                      </p>
                      <DogAlertChips flags={item.flags} />
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                );
              })}
            </section>
          );
        })
      )}
    </div>
  );
}
