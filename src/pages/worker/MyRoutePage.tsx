import { useState } from "react";
import { useMyActiveRoute, useDepartToStop, useCompleteRouteStop, type MyRouteStop } from "@/hooks/queries/useMyRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Phone, MapPin, Navigation, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const STATUS_LABELS: Record<MyRouteStop["status"], string> = {
  pending: "Pendiente",
  en_route: "En camino",
  notified: "Notificado ✓",
  arrived: "Llegó",
  completed: "Completado",
  skipped: "Omitido",
};

function StopCard({ stop }: { stop: MyRouteStop }) {
  const [skipping, setSkipping] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const depart = useDepartToStop();
  const complete = useCompleteRouteStop();

  const isDone = stop.status === "completed" || stop.status === "skipped";
  const canDepart = stop.status === "pending";
  const canComplete = stop.status === "en_route" || stop.status === "notified" || stop.status === "arrived";

  const customerName = stop.customers
    ? `${stop.customers.first_name} ${stop.customers.last_name}`.trim()
    : "Cliente";

  return (
    <Card className={isDone ? "opacity-60" : undefined}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{stop.dogs?.name ?? "Perro"}</p>
            <p className="text-sm text-muted-foreground">{customerName}</p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{STATUS_LABELS[stop.status]}</span>
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" />{stop.address_snapshot}</p>
          {stop.customers?.phone && (
            <a href={`tel:${stop.customers.phone}`} className="flex items-center gap-1.5 text-primary">
              <Phone className="h-3.5 w-3.5 shrink-0" />{stop.customers.phone}
            </a>
          )}
          {stop.eta_minutes != null && (
            <p>ETA enviado al cliente: ~{stop.eta_minutes} min</p>
          )}
          {stop.notification_error && (
            <p className="text-destructive">No se pudo notificar: {stop.notification_error}</p>
          )}
        </div>

        {canDepart && (
          <Button
            className="w-full min-h-12 gap-2"
            onClick={() => depart.mutate(stop.id)}
            disabled={depart.isPending}
          >
            {depart.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            Salí hacia aquí
          </Button>
        )}

        {stop.status === "en_route" && stop.notification_error && (
          <Button
            variant="outline"
            className="w-full min-h-12 gap-2"
            onClick={() => depart.mutate(stop.id)}
            disabled={depart.isPending}
          >
            {depart.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Reintentar notificación
          </Button>
        )}

        {canComplete && !skipping && (
          <div className="flex gap-2">
            <Button
              className="flex-1 min-h-12 gap-2"
              onClick={() => complete.mutate({ stopId: stop.id })}
              disabled={complete.isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
              Completado
            </Button>
            <Button
              variant="outline"
              className="flex-1 min-h-12 gap-2"
              onClick={() => setSkipping(true)}
            >
              <XCircle className="h-4 w-4" />
              Omitir
            </Button>
          </div>
        )}

        {skipping && (
          <div className="space-y-2">
            <Textarea
              placeholder="Motivo (ej: no contestó, no estaba en casa)"
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => complete.mutate({ stopId: stop.id, skipReason: skipReason || "Sin motivo" })}
                disabled={complete.isPending}
              >
                Confirmar omisión
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => setSkipping(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {stop.status === "skipped" && (
          <p className="text-xs text-muted-foreground">Omitida</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function MyRoutePage() {
  const { data: route, isLoading } = useMyActiveRoute();

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  if (!route) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Mi ruta</h1>
        <p className="text-sm text-muted-foreground">No tienes una ruta asignada hoy.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{route.title}</h1>
        <p className="text-sm text-muted-foreground">{route.stops.length} paradas</p>
      </div>
      <div className="space-y-3">
        {route.stops.map((stop) => (
          <StopCard key={stop.id} stop={stop} />
        ))}
      </div>
    </div>
  );
}
