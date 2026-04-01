import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Calendar, Dog, User } from "lucide-react";
import { toast } from "sonner";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Dog {
  id: string;
  name: string;
  breed: string;
  customer_id: string;
}

const SERVICE_OPTIONS = [
  { type: "daycare", name: "Guardería" },
  { type: "board_and_train", name: "Internado + Entrenamiento" },
  { type: "training_session", name: "Sesión de Entrenamiento" },
  { type: "grooming", name: "Estética / Grooming" },
  { type: "evaluation", name: "Evaluación" },
];

interface NewReservationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCustomerId?: string;
  initialDogId?: string;
  initialDate?: Date;
  onSaved?: () => void;
}

export function NewReservationModal({
  open,
  onOpenChange,
  initialCustomerId,
  initialDogId,
  initialDate,
  onSaved,
}: NewReservationModalProps) {
  const [saving, setSaving] = useState(false);

  // Form fields
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [dogId, setDogId] = useState(initialDogId ?? "");
  const [serviceType, setServiceType] = useState("daycare");
  const [startDate, setStartDate] = useState(
    initialDate ? initialDate.toISOString().slice(0, 16) : ""
  );
  const [endDate, setEndDate] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [notes, setNotes] = useState("");

  // Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingData(true);
    Promise.all([
      supabase.from("customers").select("id, first_name, last_name, email").order("first_name"),
      supabase.from("dogs").select("id, name, breed, customer_id").order("name"),
    ]).then(([custRes, dogsRes]) => {
      if (custRes.data) setCustomers(custRes.data);
      if (dogsRes.data) setDogs(dogsRes.data);
      setLoadingData(false);
    });

    // Reset on open
    setCustomerId(initialCustomerId ?? "");
    setDogId(initialDogId ?? "");
    setServiceType("daycare");
    setStartDate(initialDate ? initialDate.toISOString().slice(0, 16) : "");
    setEndDate("");
    setTotalPrice("");
    setNotes("");
  }, [open]);

  // Filter dogs by selected customer
  const filteredDogs = customerId
    ? dogs.filter((d) => d.customer_id === customerId)
    : dogs;

  // Auto-select dog if only one
  useEffect(() => {
    if (filteredDogs.length === 1 && !dogId) {
      setDogId(filteredDogs[0].id);
    }
    if (dogId && !filteredDogs.find((d) => d.id === dogId)) {
      setDogId("");
    }
  }, [customerId, filteredDogs.length]);

  const handleSave = async () => {
    if (!customerId || !dogId || !serviceType || !startDate || !endDate) {
      toast.error("Completa todos los campos requeridos");
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      toast.error("La fecha de fin debe ser posterior a la de inicio");
      return;
    }

    setSaving(true);
    const serviceName = SERVICE_OPTIONS.find((s) => s.type === serviceType)?.name ?? serviceType;
    const { data: reservation, error } = await supabase.from("reservations").insert({
      customer_id: customerId,
      dog_id: dogId,
      service_type: serviceType,
      service_name: serviceName,
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      total_price: totalPrice ? parseFloat(totalPrice) : 0,
      notes: notes || "",
      status: "requested",
    }).select("id").single();

    if (error) {
      setSaving(false);
      toast.error("Error al crear reserva");
      return;
    }

    // Create an automatic notice for the new reservation request
    const customer = customers.find((c) => c.id === customerId);
    const dog = dogs.find((d) => d.id === dogId);
    if (customer && dog && reservation) {
      await supabase.from("notices").insert({
        title: "Nueva solicitud de reserva",
        message: `${customer.first_name} ${customer.last_name} ha solicitado ${serviceName} para ${dog.name}.`,
        severity: "info",
        entity_type: "reservation",
        entity_id: reservation.id,
        auto_generated: true,
      });
    }

    setSaving(false);
    toast.success("Reserva creada", {
      description: "La solicitud ha sido registrada y está pendiente de aprobación.",
    });
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Nueva Reserva
          </DialogTitle>
          <DialogDescription>
            Registra una nueva solicitud de reserva
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Customer */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Cliente *
              </Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                      <span className="text-muted-foreground text-xs ml-2">{c.email}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dog */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Dog className="h-4 w-4" />
                Mascota *
              </Label>
              <Select value={dogId} onValueChange={setDogId} disabled={!customerId}>
                <SelectTrigger>
                  <SelectValue placeholder={customerId ? "Seleccionar mascota..." : "Primero selecciona un cliente"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredDogs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                      <span className="text-muted-foreground text-xs ml-2">{d.breed}</span>
                    </SelectItem>
                  ))}
                  {filteredDogs.length === 0 && (
                    <SelectItem value="_none" disabled>
                      Sin mascotas registradas
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Service */}
            <div className="space-y-2">
              <Label>Tipo de servicio *</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_OPTIONS.map((s) => (
                    <SelectItem key={s.type} value={s.type}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha y hora inicio *</Label>
                <Input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha y hora fin *</Label>
                <Input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label>Precio total ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas del cliente (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instrucciones especiales, alergias, etc."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loadingData}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4 mr-2" />
            )}
            Crear reserva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
