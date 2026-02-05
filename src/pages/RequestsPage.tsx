import { useState, useMemo } from "react";
import { getPopulatedReservations } from "@/data/mockData";
import { ReservationStatus, ServiceType } from "@/types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FlagIndicators } from "@/components/shared/FlagIndicators";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, X, Dog, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const serviceTypeLabels: Record<ServiceType, string> = {
  [ServiceType.DAYCARE]: "Guardería",
  [ServiceType.BOARD_AND_TRAIN]: "Internado",
  [ServiceType.TRAINING_SESSION]: "Sesión",
  [ServiceType.GROOMING]: "Grooming",
  [ServiceType.EVALUATION]: "Evaluación",
};

export default function RequestsPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const requests = useMemo(() => {
    return getPopulatedReservations().filter(
      (r) => r.status === ReservationStatus.REQUESTED
    );
  }, []);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === requests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(requests.map((r) => r.id)));
    }
  };

  const handleApprove = (ids: string[]) => {
    toast.success(`${ids.length} solicitud(es) aprobada(s)`, {
      description: "Las reservas han sido confirmadas y los clientes notificados.",
    });
    setSelectedIds(new Set());
  };

  const handleReject = (ids: string[]) => {
    toast.error(`${ids.length} solicitud(es) rechazada(s)`, {
      description: "Los clientes serán notificados del rechazo.",
    });
    setSelectedIds(new Set());
  };

  const hasBlockingFlags = (reservationId: string) => {
    const reservation = requests.find((r) => r.id === reservationId);
    return reservation?.dog?.flags.some((f) => f.severity === "critical");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Solicitudes Pendientes</h1>
          <p className="text-muted-foreground">
            Revisa y aprueba las solicitudes de reserva de los clientes
          </p>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} seleccionada(s)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleReject(Array.from(selectedIds))}
            >
              <X className="h-4 w-4 mr-2" />
              Rechazar
            </Button>
            <Button
              size="sm"
              onClick={() => handleApprove(Array.from(selectedIds))}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              <Check className="h-4 w-4 mr-2" />
              Aprobar
            </Button>
          </div>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-card">
          <div className="w-16 h-16 mb-4 rounded-2xl bg-success/10 flex items-center justify-center">
            <Check className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Todo al día</h2>
          <p className="text-muted-foreground">
            No hay solicitudes pendientes por revisar
          </p>
        </div>
      ) : (
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === requests.length}
                    onCheckedChange={toggleAll}
                    aria-label="Seleccionar todo"
                  />
                </TableHead>
                <TableHead className="min-w-[200px]">Perro / Dueño</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Fecha/Hora</TableHead>
                <TableHead>Alertas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((reservation) => {
                const hasBlocking = hasBlockingFlags(reservation.id);

                return (
                  <TableRow key={reservation.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(reservation.id)}
                        onCheckedChange={() => toggleSelection(reservation.id)}
                        aria-label={`Seleccionar ${reservation.dog?.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-background shadow">
                          <AvatarFallback className="bg-accent text-accent-foreground">
                            <Dog className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{reservation.dog?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {reservation.customer?.firstName}{" "}
                            {reservation.customer?.lastName}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">
                          {reservation.service &&
                            serviceTypeLabels[reservation.service.type]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ${reservation.totalPrice.toFixed(2)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>
                          {format(reservation.startDate, "EEE, d MMM", {
                            locale: es,
                          })}
                        </p>
                        <p className="text-muted-foreground">
                          {format(reservation.startDate, "HH:mm")} -{" "}
                          {format(reservation.endDate, "HH:mm")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <FlagIndicators flags={reservation.dog?.flags || []} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={reservation.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReject([reservation.id])}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        {hasBlocking ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-warning border-warning/50"
                            onClick={() => {
                              toast.warning("Esta solicitud tiene alertas críticas", {
                                description:
                                  "Revisa las vacunas y documentos antes de aprobar.",
                              });
                            }}
                          >
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Revisar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleApprove([reservation.id])}
                            className="bg-success text-success-foreground hover:bg-success/90"
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Aprobar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
