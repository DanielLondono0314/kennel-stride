import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Plus,
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
  const { organization } = useOrganization();

  const [notes, setNotes] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [selectedOverrides, setSelectedOverrides] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  type FreeUnit = { id: string; name: string };
  type Zone = { id: string; name: string };

  const [units, setUnits] = useState<FreeUnit[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [unitId, setUnitId] = useState("");
  const [creatingUnit, setCreatingUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitZoneId, setNewUnitZoneId] = useState("");
  const [isCreatingUnit, setIsCreatingUnit] = useState(false);

  const orgId = organization?.id;

  useEffect(() => {
    if (!open || !orgId) return;
    setUnitId("");
    setCreatingUnit(false);
    setNewUnitName("");
    Promise.all([
      supabase
        .from("facility_units")
        .select("id, name")
        .eq("organization_id", orgId)
        .eq("status", "available")
        .order("name"),
      supabase
        .from("facility_zones")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("name"),
    ]).then(([unitsRes, zonesRes]) => {
      setUnits(unitsRes.data ?? []);
      setZones(zonesRes.data ?? []);
      setNewUnitZoneId(zonesRes.data?.[0]?.id ?? "");
    });
  }, [open, orgId]);

  const handleCreateUnit = async () => {
    if (isCreatingUnit || !organization || !newUnitName.trim() || !newUnitZoneId) return;
    setIsCreatingUnit(true);
    try {
      const { data, error } = await supabase
        .from("facility_units")
        .insert({
          organization_id: organization.id,
          zone_id: newUnitZoneId,
          name: newUnitName.trim(),
          unit_type: "kennel",
          status: "available",
        })
        .select("id, name")
        .single();
      if (error || !data) {
        toast.error("No se pudo crear la perrera", { description: error?.message });
        return;
      }
      setUnits((prev) => [...prev, data]);
      setUnitId(data.id);
      setCreatingUnit(false);
      setNewUnitName("");
    } finally {
      setIsCreatingUnit(false);
    }
  };

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
      unitId,
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

  const { dog, customer, service } = reservation;
  const blockingAlerts = validation?.alerts.filter((a) => a.blocksOperation) || [];
  const allBlockingOverridden = blockingAlerts.every((a) => selectedOverrides.has(a.id));
  const validationOk = validation?.isValid || (validation?.canOverride && allBlockingOverridden && overrideReason.length > 0);
  const canProceed = validationOk && !!unitId && !creatingUnit;
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
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Perrera (obligatoria para check-in) */}
          <div className="space-y-2">
            <Label htmlFor="unit-select" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Perrera *
            </Label>

            {!creatingUnit ? (
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger id="unit-select">
                  <SelectValue placeholder={
                    units.length ? "Elegir perrera libre…" : "No hay perreras libres"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2 rounded-lg border p-3">
                <Input
                  placeholder="Nombre de la perrera (ej. A-4)"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                />
                <Select value={newUnitZoneId} onValueChange={setNewUnitZoneId}>
                  <SelectTrigger><SelectValue placeholder="Zona" /></SelectTrigger>
                  <SelectContent>
                    {zones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleCreateUnit}
                    disabled={!newUnitName.trim() || !newUnitZoneId || isCreatingUnit}>
                    Crear y usar
                  </Button>
                  <Button type="button" size="sm" variant="ghost"
                    onClick={() => setCreatingUnit(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {!creatingUnit && (
              <Button type="button" variant="ghost" size="sm"
                className="h-auto p-0 text-xs text-primary"
                onClick={() => setCreatingUnit(true)}>
                <Plus className="h-3 w-3 mr-1" /> Crear perrera nueva…
              </Button>
            )}
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
