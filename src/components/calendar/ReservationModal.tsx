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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Reservation,
  ReservationStatus,
  Dog,
  Customer,
  Service,
  Location,
} from "@/types";
import {
  mockCustomers,
  mockDogs,
  mockServices,
  mockLocations,
  getAvailablePackageForService,
} from "@/data/mockData";
import { format, setHours, setMinutes } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  Clock,
  Dog as DogIcon,
  User,
  MapPin,
  Package,
  FileText,
  History,
  CalendarDays,
  Loader2,
  Save,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ReservationModalProps {
  reservation?: Reservation | null;
  initialDate?: Date | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (reservation: Partial<Reservation>) => void;
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6 AM to 8 PM

const statusLabels: Record<ReservationStatus, string> = {
  [ReservationStatus.REQUESTED]: "Solicitado",
  [ReservationStatus.SCHEDULED]: "Programado",
  [ReservationStatus.CHECKED_IN]: "Registrado",
  [ReservationStatus.IN_PROGRESS]: "En Progreso",
  [ReservationStatus.READY]: "Listo",
  [ReservationStatus.PICKED_UP]: "Recogido",
  [ReservationStatus.COMPLETED]: "Completado",
  [ReservationStatus.CANCELLED]: "Cancelado",
};

export function ReservationModal({
  reservation,
  initialDate,
  open,
  onOpenChange,
  onSave,
}: ReservationModalProps) {
  const isEditing = !!reservation;

  // Form state
  const [customerId, setCustomerId] = useState(reservation?.customerId || "");
  const [dogId, setDogId] = useState(reservation?.dogId || "");
  const [serviceId, setServiceId] = useState(reservation?.serviceId || "");
  const [locationId, setLocationId] = useState(reservation?.locationId || "");
  const [startDate, setStartDate] = useState<Date | undefined>(
    reservation?.startDate ? new Date(reservation.startDate) : initialDate || new Date()
  );
  const [startHour, setStartHour] = useState(
    reservation?.startDate ? format(new Date(reservation.startDate), "HH") : "09"
  );
  const [startMinute, setStartMinute] = useState(
    reservation?.startDate ? format(new Date(reservation.startDate), "mm") : "00"
  );
  const [endHour, setEndHour] = useState(
    reservation?.endDate ? format(new Date(reservation.endDate), "HH") : "17"
  );
  const [endMinute, setEndMinute] = useState(
    reservation?.endDate ? format(new Date(reservation.endDate), "mm") : "00"
  );
  const [notes, setNotes] = useState(reservation?.notes || "");
  const [employeeNotes, setEmployeeNotes] = useState(reservation?.employeeNotes || "");
  const [usePackage, setUsePackage] = useState(reservation?.usePackageCredits || false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get customer's dogs
  const customerDogs = useMemo(() => {
    if (!customerId) return [];
    return mockDogs.filter((d) => d.customerId === customerId);
  }, [customerId]);

  // Get selected service
  const selectedService = useMemo(() => {
    return mockServices.find((s) => s.id === serviceId);
  }, [serviceId]);

  // Get available package
  const availablePackage = useMemo(() => {
    if (!customerId || !selectedService) return null;
    return getAvailablePackageForService(customerId, selectedService.type);
  }, [customerId, selectedService]);

  // Calculate price
  const calculatedPrice = useMemo(() => {
    if (!selectedService) return 0;
    if (usePackage && availablePackage) return 0;
    return selectedService.price;
  }, [selectedService, usePackage, availablePackage]);

  // Reset dog when customer changes
  const handleCustomerChange = (newCustomerId: string) => {
    setCustomerId(newCustomerId);
    setDogId("");
  };

  const handleSubmit = async () => {
    if (!customerId || !dogId || !serviceId || !startDate) {
      toast.error("Completa todos los campos requeridos");
      return;
    }

    setIsSubmitting(true);

    // Build dates
    const start = setMinutes(
      setHours(startDate, parseInt(startHour)),
      parseInt(startMinute)
    );
    const end = setMinutes(
      setHours(startDate, parseInt(endHour)),
      parseInt(endMinute)
    );

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    onSave({
      id: reservation?.id,
      customerId,
      dogId,
      serviceId,
      locationId: locationId || undefined,
      startDate: start,
      endDate: end,
      notes: notes || undefined,
      employeeNotes: employeeNotes || undefined,
      usePackageCredits: usePackage,
      packageId: usePackage && availablePackage ? availablePackage.id : undefined,
      totalPrice: calculatedPrice,
      status: reservation?.status || ReservationStatus.SCHEDULED,
    });

    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {isEditing ? "Editar Reserva" : "Nueva Reserva"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Modificar reserva de ${reservation?.dog?.name}`
              : "Crear una nueva reserva o sesión"}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="data" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="data" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Datos
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Notas
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1.5" disabled={!isEditing}>
              <History className="h-3.5 w-3.5" />
              Historial
            </TabsTrigger>
            <TabsTrigger value="future" className="flex items-center gap-1.5" disabled={!isEditing}>
              <CalendarDays className="h-3.5 w-3.5" />
              Futuras
            </TabsTrigger>
          </TabsList>

          {/* Data Tab */}
          <TabsContent value="data" className="space-y-6 mt-6">
            {/* Status header for editing */}
            {isEditing && reservation && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {statusLabels[reservation.status]}
                  </Badge>
                  {reservation.checkInTime && (
                    <span className="text-xs text-muted-foreground">
                      Check-in: {format(new Date(reservation.checkInTime), "HH:mm")}
                    </span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  ID: {reservation.id}
                </span>
              </div>
            )}

            {/* Customer & Dog Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Cliente *
                </Label>
                <Select value={customerId} onValueChange={handleCustomerChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockCustomers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.firstName} {customer.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <DogIcon className="h-3.5 w-3.5" />
                  Perro *
                </Label>
                <Select
                  value={dogId}
                  onValueChange={setDogId}
                  disabled={!customerId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={customerId ? "Seleccionar perro" : "Primero selecciona cliente"} />
                  </SelectTrigger>
                  <SelectContent>
                    {customerDogs.map((dog) => (
                      <SelectItem key={dog.id} value={dog.id}>
                        {dog.name} ({dog.breed})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Service & Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Servicio *</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockServices.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{service.name}</span>
                          <span className="text-muted-foreground ml-2">
                            ${service.price}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Ubicación
                </Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar ubicación" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockLocations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Fecha *
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate
                        ? format(startDate, "PPP", { locale: es })
                        : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Hora Inicio *
                </Label>
                <div className="flex gap-2">
                  <Select value={startHour} onValueChange={setStartHour}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h} value={h.toString().padStart(2, "0")}>
                          {h.toString().padStart(2, "0")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="self-center">:</span>
                  <Select value={startMinute} onValueChange={setStartMinute}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["00", "15", "30", "45"].map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Hora Fin *
                </Label>
                <div className="flex gap-2">
                  <Select value={endHour} onValueChange={setEndHour}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h} value={h.toString().padStart(2, "0")}>
                          {h.toString().padStart(2, "0")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="self-center">:</span>
                  <Select value={endMinute} onValueChange={setEndMinute}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["00", "15", "30", "45"].map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Package & Pricing */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Resumen de Precio</Label>
                  {selectedService && (
                    <p className="text-sm text-muted-foreground">
                      {selectedService.name}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className={cn("text-2xl font-bold", usePackage && availablePackage && "text-success")}>
                    {usePackage && availablePackage
                      ? "Incluido"
                      : `$${calculatedPrice.toFixed(2)}`}
                  </p>
                  {usePackage && availablePackage && (
                    <p className="text-xs text-muted-foreground">
                      Se descontará 1 crédito del paquete
                    </p>
                  )}
                </div>
              </div>

              {availablePackage && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{availablePackage.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {availablePackage.remainingCredits} de {availablePackage.totalCredits} créditos disponibles
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="use-package" className="text-sm">
                      Usar paquete
                    </Label>
                    <Switch
                      id="use-package"
                      checked={usePackage}
                      onCheckedChange={setUsePackage}
                    />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Notas del Cliente</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instrucciones especiales, preferencias del dueño..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Estas notas serán visibles para todo el equipo
                </p>
              </div>

              <div className="space-y-2">
                <Label>Notas Internas (Solo Staff)</Label>
                <Textarea
                  value={employeeNotes}
                  onChange={(e) => setEmployeeNotes(e.target.value)}
                  placeholder="Observaciones del equipo, seguimiento..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Solo visible para empleados, no para el pet parent
                </p>
              </div>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium mb-1">Historial de Reservas</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Aquí verás el historial de reservas anteriores del perro con el mismo servicio.
              </p>
            </div>
          </TabsContent>

          {/* Future Tab */}
          <TabsContent value="future" className="mt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium mb-1">Reservas Futuras</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Aquí verás las próximas reservas programadas para este perro.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !customerId || !dogId || !serviceId}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? "Guardar Cambios" : "Crear Reserva"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
