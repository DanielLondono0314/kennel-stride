import { Price } from "@/components/shared/Price";
import { usePermission } from "@/hooks/usePermission";
import { useState, useMemo, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Reservation } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Dog,
  Clock,
  LogOut,
  Loader2,
  CreditCard,
  CalendarCheck,
  Receipt,
  Wallet,
  CheckCircle2,
  User,
  Phone,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { planProgressText, plansCoveringReservation, type DogPlan } from "@/lib/dogPlans";

interface CheckOutModalProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: { reservationId: string }) => void | Promise<void>;
}

/** "plan:<id>" = cubierto por ese plan del perro (no se factura). */
type PaymentMethod = "cash" | "card" | "invoice" | `plan:${string}`;

export function CheckOutModal({
  reservation,
  open,
  onOpenChange,
  onConfirm,
}: CheckOutModalProps) {
  const { organization } = useOrganization();
  const { categoryFor } = useServiceTypes();
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  // Cobrar (efectivo, tarjeta, factura) y descontar de un plan son permisos distintos.
  const canCharge = usePermission("invoices.create");
  const canUsePlans = usePermission("plans.use");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dogPlans, setDogPlans] = useState<DogPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Planes del perro: si alguno cubre este servicio, el check-out no se cobra
  // aparte (el cobro fue la venta del plan).
  useEffect(() => {
    if (!open || !reservation) {
      setDogPlans([]);
      return;
    }
    let cancelled = false;
    const fetchPlans = async () => {
      if (!organization || !reservation.dogId) return;
      setLoadingPlans(true);
      const { data } = await supabase
        .from("dog_plans")
        .select("*")
        .eq("organization_id", organization.id)
        .eq("dog_id", reservation.dogId)
        .eq("status", "active");
      if (cancelled) return;
      setDogPlans((data ?? []) as DogPlan[]);
      setLoadingPlans(false);
    };
    fetchPlans();
    return () => { cancelled = true; };
    // Keyed a propósito por id: reservation cambia de identidad en cada
    // refetch del Dashboard y re-consultaría sin necesidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reservation?.id, organization?.id]);

  const coverage = useMemo(() => {
    if (!reservation?.service?.type) return [];
    return plansCoveringReservation(dogPlans, {
      serviceType: reservation.service.type,
      category: categoryFor(reservation.service.type),
      startDate: reservation.startDate,
      checkIn: reservation.checkInTime ?? reservation.startDate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dogPlans, reservation?.id, categoryFor]);

  // Por defecto, el primer plan al que le alcanza.
  useEffect(() => {
    const best = canUsePlans ? coverage.find((c) => c.ok) : undefined;
    setPaymentMethod(best ? `plan:${best.plan.id}` : "cash");
  }, [coverage, canUsePlans]);

  const selectedPlan = paymentMethod.startsWith("plan:")
    ? coverage.find((c) => `plan:${c.plan.id}` === paymentMethod) ?? null
    : null;
  const methodAllowed = selectedPlan ? canUsePlans && selectedPlan.ok : canCharge;

  // Calculate stay duration
  const stayInfo = useMemo(() => {
    if (!reservation?.checkInTime) return null;

    const checkIn = reservation.checkInTime;
    const now = new Date();
    const durationMinutes = differenceInMinutes(now, checkIn);
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    return {
      checkInTime: checkIn,
      duration: `${hours}h ${minutes}m`,
      durationMinutes,
    };
  }, [reservation]);

  const handleConfirm = async () => {
    if (!reservation) return;
    if (!organization) {
      toast.error("No se pudo procesar el check-out", { description: "Vuelve a iniciar sesión e inténtalo de nuevo." });
      return;
    }
    setIsSubmitting(true);

    try {
      // Check-out atómico: pago + notas + liberación de perrera + completitud
      // en UNA transacción (RPC complete_checkout). Antes el pago se hacía en
      // el cliente y luego se llamaba al RPC de completitud: si este fallaba,
      // quedaba una factura huérfana con la reserva aún en curso.
      const { error } = await supabase.rpc("complete_checkout", {
        p_reservation_id: reservation.id,
        p_payment_method: selectedPlan ? "plan" : paymentMethod,
        p_plan_id: selectedPlan?.plan.id,
        p_notes: notes,
      });

      if (error) {
        toast.error("No se pudo procesar el check-out", {
          description: error.message || "Inténtalo de nuevo.",
        });
        return;
      }

      await onConfirm({ reservationId: reservation.id });
      onOpenChange(false);
      setNotes("");
      setPaymentMethod("cash");
    } catch {
      toast.error("No se pudo procesar el check-out", { description: "Inténtalo de nuevo." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
      setNotes("");
    }
  };

  if (!reservation) return null;

  const { dog, customer, service } = reservation;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-primary" />
            Check-out
          </DialogTitle>
          <DialogDescription>
            Registrar salida para {dog?.name}
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

          {/* Stay Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Resumen de Estancia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Entrada</p>
                  <p className="font-medium">
                    {stayInfo
                      ? format(stayInfo.checkInTime, "HH:mm", { locale: es })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Salida</p>
                  <p className="font-medium">
                    {format(new Date(), "HH:mm", { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duración</p>
                  <p className="font-medium">{stayInfo?.duration || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service & Price */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Servicio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{service?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {service?.description}
                  </p>
                </div>
                {selectedPlan ? (
                  <div className="text-right">
                    <p className="text-sm font-semibold text-success">Incluido en el plan</p>
                    <p className="text-xs text-muted-foreground line-through"><Price value={reservation.totalPrice} /></p>
                  </div>
                ) : (
                  <p className="text-xl font-bold">
                    <Price value={reservation.totalPrice} />
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Payment Method */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Método de Pago
            </Label>

            {loadingPlans ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando el plan del perro...
              </div>
            ) : (
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                className="grid gap-3"
              >
                {/* Planes del perro que cubren este servicio */}
                {canUsePlans && coverage.map(({ plan, units, ok, reason }) => {
                  const value = `plan:${plan.id}` as const;
                  return (
                    <label
                      key={plan.id}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-lg border-2 transition-all",
                        !ok && "cursor-not-allowed opacity-60",
                        ok && "cursor-pointer",
                        paymentMethod === value
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-muted-foreground/30"
                      )}
                    >
                      <RadioGroupItem value={value} disabled={!ok} />
                      <CalendarCheck className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium">Plan: {plan.service_label}</p>
                        <p className="text-sm text-muted-foreground">
                          {reason ?? planProgressText(plan)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-success/10 text-success">
                        {units > 0 ? `−${units} ${plan.unit_label ?? "unidades"}` : "Incluido"}
                      </Badge>
                    </label>
                  );
                })}

                {canCharge && (
                <>
                {/* Cash option */}
                <label
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                    paymentMethod === "cash"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <RadioGroupItem value="cash" />
                  <Wallet className="h-5 w-5 text-success" />
                  <div className="flex-1">
                    <p className="font-medium">Efectivo</p>
                    <p className="text-sm text-muted-foreground">
                      Pago inmediato en efectivo
                    </p>
                  </div>
                  <Badge variant="outline"><Price value={reservation.totalPrice} /></Badge>
                </label>

                {/* Card option */}
                <label
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                    paymentMethod === "card"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <RadioGroupItem value="card" />
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">Tarjeta</p>
                    <p className="text-sm text-muted-foreground">
                      Pago con tarjeta de crédito/débito
                    </p>
                  </div>
                  <Badge variant="outline"><Price value={reservation.totalPrice} /></Badge>
                </label>

                {/* Invoice option */}
                <label
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                    paymentMethod === "invoice"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <RadioGroupItem value="invoice" />
                  <FileText className="h-5 w-5 text-warning" />
                  <div className="flex-1">
                    <p className="font-medium">Agregar a Factura</p>
                    <p className="text-sm text-muted-foreground">
                      Cobrar después con factura
                      {customer && customer.balance < 0 && (
                        <span className="text-warning ml-1">
                          (Saldo actual: <Price value={Math.abs(customer.balance)} perm="invoices.view" />)
                        </span>
                      )}
                    </p>
                  </div>
                  <Badge variant="outline"><Price value={reservation.totalPrice} /></Badge>
                </label>
                </>
                )}
              </RadioGroup>
            )}
            {!loadingPlans && !methodAllowed && (
              <p className="text-sm text-muted-foreground">
                Tu rol no puede cobrar{canUsePlans ? " y ningún plan del perro cubre este servicio" : ""}: pide a
                alguien con permiso de cobrar que haga este check-out.
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="checkout-notes">Notas de Check-out (opcional)</Label>
            <Textarea
              id="checkout-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones del día, comportamiento, incidentes..."
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
            disabled={isSubmitting || loadingPlans || !methodAllowed}
            className="min-w-[140px] bg-success hover:bg-success/90 text-success-foreground"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Check-out
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
