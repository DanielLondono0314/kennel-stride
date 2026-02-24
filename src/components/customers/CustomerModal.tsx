import { useState, useEffect } from "react";
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
import { Customer } from "@/types";
import { User, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface CustomerModalProps {
  customer?: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<Customer>) => void;
}

export function CustomerModal({ customer, open, onOpenChange, onSave }: CustomerModalProps) {
  const isEditing = !!customer;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (customer) {
      setFirstName(customer.firstName);
      setLastName(customer.lastName);
      setEmail(customer.email);
      setPhone(customer.phone);
      setAddress(customer.address || "");
      setCity(customer.city || "");
      setState(customer.state || "");
      setZipCode(customer.zipCode || "");
      setEmergencyContactName(customer.emergencyContactName || "");
      setEmergencyContactPhone(customer.emergencyContactPhone || "");
      setNotes(customer.notes || "");
    } else {
      setFirstName(""); setLastName(""); setEmail(""); setPhone("");
      setAddress(""); setCity(""); setState(""); setZipCode("");
      setEmergencyContactName(""); setEmergencyContactPhone(""); setNotes("");
    }
  }, [customer, open]);

  const handleSubmit = async () => {
    if (!firstName || !lastName || !email || !phone) {
      toast.error("Completa los campos requeridos");
      return;
    }
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    onSave({
      id: customer?.id,
      firstName, lastName, email, phone,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      zipCode: zipCode || undefined,
      emergencyContactName: emergencyContactName || undefined,
      emergencyContactPhone: emergencyContactPhone || undefined,
      notes: notes || undefined,
    });
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {isEditing ? "Editar Cliente" : "Nuevo Cliente"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? `Editar información de ${customer?.firstName}` : "Registrar un nuevo cliente"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nombre" />
            </div>
            <div className="space-y-2">
              <Label>Apellido *</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellido" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555-0000" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dirección</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección completa" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ciudad" />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="Estado" />
            </div>
            <div className="space-y-2">
              <Label>Código Postal</Label>
              <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="00000" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contacto de emergencia</Label>
              <Input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} placeholder="Nombre" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono de emergencia</Label>
              <Input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="+1 555-0000" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionales sobre el cliente..." rows={3} />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isEditing ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
