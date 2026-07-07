import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
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
import { focusFirstInvalid } from "@/lib/forms";

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
  const { organization } = useOrganization();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  // Errores inline por campo (PR-13).
  const [errors, setErrors] = useState<Record<string, string>>({});
  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

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
    if (!organization) return;
    setLoadingData(true);
    Promise.all([
      supabase.from("customers").select("id, first_name, last_name, email").eq("organization_id", organization!.id).order("first_name"),
      supabase.from("dogs").select("id, name, breed, customer_id").eq("organization_id", organization!.id).order("name"),
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
    setErrors({});
    // Reset intencional SOLO al abrir: los initial* son props que cambian de
    // identidad en cada render del padre y borrarían lo que el usuario escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, organization]);

  // Filter dogs by selected customer (memoizado para poder usarlo como dep)
  const filteredDogs = useMemo(
    () => (customerId ? dogs.filter((d) => d.customer_id === customerId) : dogs),
    [dogs, customerId]
  );

  // Auto-select dog if only one
  useEffect(() => {
    if (filteredDogs.length === 1 && !dogId) {
      setDogId(filteredDogs[0].id);
    }
    if (dogId && !filteredDogs.find((d) => d.id === dogId)) {
      setDogId("");
    }
  }, [filteredDogs, dogId]);

  const handleSave = async () => {
    if (!organization) return;
    const errs: Record<string, string> = {};
    if (!customerId) errs.customerId = "Selecciona un cliente";
    if (!dogId) errs.dogId = "Selecciona una mascota";
    if (!startDate) errs.startDate = "Indica la fecha de inicio";
    if (!endDate) errs.endDate = "Indica la fecha de fin";
    else if (startDate && new Date(endDate) <= new Date(startDate)) {
      errs.endDate = "Debe ser posterior a la fecha de inicio";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      focusFirstInvalid();
      return;
    }
    setErrors({});

    setSaving(true);
    const serviceName = SERVICE_OPTIONS.find((s) => s.type === serviceType)?.name ?? serviceType;

    // Try to link this reservation to the current user's staff record (if any)
    // so it shows up in the dashboard's "My Tasks" section.
    let staffId: string | null = null;
    if (user) {
      const { data: staffRow } = await supabase
        .from("staff_members")
        .select("id")
        .eq("organization_id", organization.id)
        .eq("profile_id", user.id)
        .maybeSingle();
      staffId = staffRow?.id ?? null;
    }

    // H2/H5: creación transaccional vía RPC. Rechaza solapamiento para el mismo
    // perro (anti doble-booking) y crea reserva + notice atómicamente.
    const { error } = await supabase.rpc("create_reservation", {
      p_customer_id: customerId,
      p_dog_id: dogId,
      p_service_type: serviceType,
      p_service_name: serviceName,
      p_start: new Date(startDate).toISOString(),
      p_end: new Date(endDate).toISOString(),
      p_total_price: totalPrice ? parseFloat(totalPrice) : 0,
      p_notes: notes || "",
      p_staff_id: staffId,
    });

    if (error) {
      setSaving(false);
      // El RPC lanza mensajes claros (solapamiento, pertenencia inválida).
      toast.error(error.message || "Error al crear reserva");
      return;
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
              <Select value={customerId} onValueChange={(v) => { setCustomerId(v); clearError("customerId"); }}>
                <SelectTrigger
                  aria-invalid={errors.customerId ? true : undefined}
                  aria-describedby={errors.customerId ? "res-customer-error" : undefined}
                  className={errors.customerId ? "border-destructive focus:ring-destructive" : ""}
                >
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
              {errors.customerId && <p id="res-customer-error" className="text-xs text-destructive">{errors.customerId}</p>}
            </div>

            {/* Dog */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Dog className="h-4 w-4" />
                Mascota *
              </Label>
              <Select value={dogId} onValueChange={(v) => { setDogId(v); clearError("dogId"); }} disabled={!customerId}>
                <SelectTrigger
                  aria-invalid={errors.dogId ? true : undefined}
                  aria-describedby={errors.dogId ? "res-dog-error" : undefined}
                  className={errors.dogId ? "border-destructive focus:ring-destructive" : ""}
                >
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
              {errors.dogId && <p id="res-dog-error" className="text-xs text-destructive">{errors.dogId}</p>}
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
                  onChange={(e) => { setStartDate(e.target.value); clearError("startDate"); }}
                  aria-invalid={errors.startDate ? true : undefined}
                  aria-describedby={errors.startDate ? "res-start-error" : undefined}
                  className={errors.startDate ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.startDate && <p id="res-start-error" className="text-xs text-destructive">{errors.startDate}</p>}
              </div>
              <div className="space-y-2">
                <Label>Fecha y hora fin *</Label>
                <Input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); clearError("endDate"); }}
                  min={startDate}
                  aria-invalid={errors.endDate ? true : undefined}
                  aria-describedby={errors.endDate ? "res-end-error" : undefined}
                  className={errors.endDate ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.endDate && <p id="res-end-error" className="text-xs text-destructive">{errors.endDate}</p>}
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
