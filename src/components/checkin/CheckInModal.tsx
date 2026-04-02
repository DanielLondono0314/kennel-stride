import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ValidationAlerts } from "./ValidationAlerts";
import { Reservation, FlagSeverity, CheckInData } from "@/types";
import { validateCheckIn } from "@/lib/validations";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dog,
  Clock,
  MapPin,
  User,
  Phone,
  AlertTriangle,
  LogIn,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckInModalProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: CheckInData) => void;
}

export function CheckInModal({
  reservation,
  open,
  onOpenChange,
  onConfirm,
}: CheckInModalProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [selectedOverrides, setSelectedOverrides] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate check-in requirements
  const validation = useMemo(() => {
    if (!reservation?.dog || !reservation?.customer || !reservation?.service) {
      return null;
    }
    return validateCheckIn(
      reservation,
      reservation.dog,
      reservation.customer,
      reservation.service
    );
  }, [reservation]);

  const handleToggleOverride = (alertId: string) => {
    setSelectedOverrides((prev) => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!reservation) return;

    setIsSubmitting(true);

    onConfirm({
      reservationId: reservation.id,
      notes: notes || undefined,
      overrideAlerts: Array.from(selectedOverrides),
      overrideReason: overrideReason || undefined,
      overrideBy: user?.id,
    });

    setIsSubmitting(false);
    setNotes("");
    setOverrideReason("");
    setSelectedOverrides(new Set());
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
      setNotes("");
      setOverrideReason("");
      setSelectedOverrides(new Set());
    }
  };

  if (!reservation) return null;

  const { dog, customer, service, location } = reservation;
  const blockingAlerts = validation?.alerts.filter((a) => a.blocksCheckIn) || [];
  const allBlockingOverridden = blockingAlerts.every((a) => selectedOverrides.has(a.id));
  const canProceed = validation?.isValid || (validation?.canOverride && allBlockingOverridden && overrideReason.length > 0);
  const needsOverrideReason = selectedOverrides.size > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-primary" />
            Check-in
          </DialogTitle>
          <DialogDescription>
            Registrar entrada para {dog?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Dog & Owner Info */}
          <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
            <Avatar className="h-16 w-16 border-2 border-background shadow-md">
              {dog?.avatarUrl ? (
                <AvatarImage src={dog.avatarUrl} alt={dog?.name} />
              ) : (
                <AvatarFallback className="bg-accent text-accent-foreground text-lg">
                  <Dog className="h-8 w-8" />
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{dog?.name}</h3>
                <Badge variant="outline" className="text-xs">
                  {dog?.breed}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {customer?.firstName} {customer?.lastName}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {customer?.phone}
                </span>
              </div>
            </div>
          </div>

          {/* Service Info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Servicio</Label>
              <p className="font-medium">{service?.name}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Horario</Label>
              <p className="font-medium flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {format(reservation.startDate, "HH:mm", { locale: es })} -{" "}
                {format(reservation.endDate, "HH:mm", { locale: es })}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ubicación</Label>
              <p className="font-medium flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {location?.name || "Sin asignar"}
              </p>
            </div>
          </div>

          {/* Package Info if applicable */}
          {reservation.usePackageCredits && reservation.package && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{reservation.package.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {reservation.package.remainingCredits} créditos disponibles
                  </p>
                </div>
              </div>
              <Badge variant="secondary">-1 crédito</Badge>
            </div>
          )}

          <Separator />

          {/* Validation Alerts */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <Label>Validaciones</Label>
            </div>
            {validation && (
              <ValidationAlerts
                alerts={validation.alerts}
                selectedOverrides={selectedOverrides}
                onToggleOverride={handleToggleOverride}
                canOverride={validation.canOverride}
              />
            )}
          </div>

          {/* Override Reason (if needed) */}
          {needsOverrideReason && (
            <div className="space-y-2 p-4 rounded-lg bg-warning/10 border border-warning/30">
              <Label htmlFor="override-reason" className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4" />
                Razón del Override
              </Label>
              <Textarea
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explica por qué se autoriza el check-in a pesar de las alertas..."
                className="resize-none"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Este override quedará registrado en el historial
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="checkin-notes">Notas de Check-in (opcional)</Label>
            <Textarea
              id="checkin-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones especiales, observaciones del dueño..."
              className="resize-none"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canProceed || isSubmitting}
            className={cn(
              "min-w-[140px]",
              canProceed
                ? "bg-success hover:bg-success/90 text-success-foreground"
                : ""
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Confirmar Check-in
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
