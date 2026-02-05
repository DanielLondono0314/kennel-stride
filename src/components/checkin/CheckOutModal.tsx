import { useState, useMemo } from "react";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Reservation, CheckOutData, ServiceType } from "@/types";
import { getAvailablePackageForService } from "@/data/mockData";
import { format, differenceInMinutes, differenceInHours } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dog,
  Clock,
  LogOut,
  Loader2,
  CreditCard,
  Package,
  Receipt,
  Wallet,
  CheckCircle2,
  User,
  Phone,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckOutModalProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: CheckOutData) => void;
}

type PaymentMethod = "package" | "cash" | "card" | "invoice";

export function CheckOutModal({
  reservation,
  open,
  onOpenChange,
  onConfirm,
}: CheckOutModalProps) {
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("package");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check for available package
  const availablePackage = useMemo(() => {
    if (!reservation?.customer || !reservation?.service) return null;
    return getAvailablePackageForService(
      reservation.customer.id,
      reservation.service.type
    );
  }, [reservation]);

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

    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    onConfirm({
      reservationId: reservation.id,
      notes: notes || undefined,
      usePackageCredits: paymentMethod === "package",
      packageId: paymentMethod === "package" ? availablePackage?.id : undefined,
      creditsToUse: paymentMethod === "package" ? 1 : undefined,
      generateInvoice: paymentMethod === "invoice",
      paymentMethod,
    });

    setIsSubmitting(false);
    setNotes("");
    setPaymentMethod("package");
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
      setNotes("");
      setPaymentMethod(availablePackage ? "package" : "cash");
    }
  };

  if (!reservation) return null;

  const { dog, customer, service } = reservation;

  // Set default payment method based on available package
  const defaultPaymentMethod = availablePackage ? "package" : "cash";
  if (paymentMethod === "package" && !availablePackage) {
    setPaymentMethod("cash");
  }

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
                <p className="text-xl font-bold">
                  ${reservation.totalPrice.toFixed(2)}
                </p>
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
            
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              className="grid gap-3"
            >
              {/* Package option */}
              {availablePackage && (
                <label
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                    paymentMethod === "package"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <RadioGroupItem value="package" />
                  <Package className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">{availablePackage.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {availablePackage.remainingCredits} créditos disponibles
                      {" · "}
                      Vence {format(availablePackage.expiresAt, "d 'de' MMM", { locale: es })}
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-success/10 text-success">
                    -1 crédito
                  </Badge>
                </label>
              )}

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
                <Badge variant="outline">${reservation.totalPrice.toFixed(2)}</Badge>
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
                <Badge variant="outline">${reservation.totalPrice.toFixed(2)}</Badge>
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
                        (Saldo actual: ${Math.abs(customer.balance).toFixed(2)})
                      </span>
                    )}
                  </p>
                </div>
                <Badge variant="outline">${reservation.totalPrice.toFixed(2)}</Badge>
              </label>
            </RadioGroup>
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
            disabled={isSubmitting}
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
