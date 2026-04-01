import { useState } from "react";
import { Reservation, ReservationStatus, ServiceType } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FlagIndicators } from "@/components/shared/FlagIndicators";
import {
  MoreHorizontal,
  LogIn,
  LogOut,
  Eye,
  Edit,
  FileText,
  CreditCard,
  ChevronDown,
  ChevronRight,
  Dog,
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface OpsTableProps {
  reservations: Reservation[];
  onCheckIn?: (reservationId: string) => void;
  onCheckOut?: (reservationId: string) => void;
  onView?: (reservationId: string) => void;
  onApprove?: (reservationId: string) => void;
  onCancel?: (reservationId: string) => void;
}

const serviceTypeLabels: Record<ServiceType, string> = {
  [ServiceType.DAYCARE]: "Guardería",
  [ServiceType.BOARD_AND_TRAIN]: "Internado",
  [ServiceType.TRAINING_SESSION]: "Sesión",
  [ServiceType.GROOMING]: "Grooming",
  [ServiceType.EVALUATION]: "Evaluación",
};

export function OpsTable({ reservations, onCheckIn, onCheckOut, onView, onApprove, onCancel }: OpsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getPrimaryAction = (status: ReservationStatus) => {
    switch (status) {
      case ReservationStatus.SCHEDULED:
        return { label: "Check-in", icon: LogIn, action: "checkin" as const };
      case ReservationStatus.CHECKED_IN:
      case ReservationStatus.IN_PROGRESS:
      case ReservationStatus.READY:
        return { label: "Check-out", icon: LogOut, action: "checkout" as const };
      case ReservationStatus.REQUESTED:
        return { label: "Aprobar", icon: CheckCircle, action: "approve" as const };
      default:
        return null;
    }
  };

  const handlePrimaryAction = (action: string, id: string) => {
    if (action === "checkin") onCheckIn?.(id);
    else if (action === "checkout") onCheckOut?.(id);
    else if (action === "approve") onApprove?.(id);
  };

  return (
    <div className="border rounded-lg bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-10"></TableHead>
            <TableHead className="min-w-[200px]">Perro / Dueño</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Ubicación</TableHead>
            <TableHead>Horario</TableHead>
            <TableHead>Alertas</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.map((reservation) => {
            const isExpanded = expandedRows.has(reservation.id);
            const primaryAction = getPrimaryAction(reservation.status);

            return (
              <>
                <TableRow
                  key={reservation.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    isExpanded && "bg-muted/30 border-l-2 border-l-primary"
                  )}
                  onClick={() => toggleRow(reservation.id)}
                >
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border-2 border-background shadow">
                        {reservation.dog?.avatarUrl ? (
                          <AvatarImage src={reservation.dog.avatarUrl} alt={reservation.dog?.name} />
                        ) : (
                          <AvatarFallback className="bg-accent text-accent-foreground">
                            <Dog className="h-5 w-5" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <p className="font-medium">{reservation.dog?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {reservation.customer?.firstName} {reservation.customer?.lastName}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      {reservation.service && serviceTypeLabels[reservation.service.type]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {reservation.location?.name || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p>{format(reservation.startDate, "HH:mm", { locale: es })}</p>
                      <p className="text-muted-foreground">
                        {format(reservation.endDate, "HH:mm", { locale: es })}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <FlagIndicators flags={reservation.dog?.flags || []} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={reservation.status} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {primaryAction && (
                        <Button
                          size="sm"
                          className="action-button-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrimaryAction(primaryAction.action, reservation.id);
                          }}
                        >
                          <primaryAction.icon className="h-3.5 w-3.5" />
                          {primaryAction.label}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="action-button-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onView?.(reservation.id);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Abrir
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView?.(reservation.id)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar reserva
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileText className="mr-2 h-4 w-4" />
                            Crear report card
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Ver factura
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onCancel?.(reservation.id)}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancelar reserva
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow key={`${reservation.id}-expanded`} className="bg-muted/20 hover:bg-muted/20">
                    <TableCell colSpan={8} className="py-4">
                      <div className="pl-12 animate-fade-in">
                        <div className="grid grid-cols-4 gap-6">
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Información del perro</h4>
                            <div className="space-y-1 text-sm">
                              <p><span className="text-muted-foreground">Raza:</span> {reservation.dog?.breed}</p>
                              <p><span className="text-muted-foreground">Peso:</span> {reservation.dog?.weight} kg</p>
                              <p><span className="text-muted-foreground">Género:</span> {reservation.dog?.gender === "male" ? "Macho" : "Hembra"}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contacto</h4>
                            <div className="space-y-1 text-sm">
                              <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{reservation.customer?.phone}</p>
                              <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{reservation.customer?.city}, {reservation.customer?.state}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Servicio</h4>
                            <div className="space-y-1 text-sm">
                              <p>{reservation.service?.name}</p>
                              <p className="text-muted-foreground">${reservation.totalPrice.toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notas</h4>
                            <p className="text-sm text-muted-foreground">{reservation.notes || "Sin notas"}</p>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
          {reservations.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Dog className="h-8 w-8" />
                  <p>No hay reservas en esta categoría</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
