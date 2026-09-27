import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Loader2, Save, MapPinCheck, MapPinOff } from "lucide-react";
import { toast } from "sonner";
import type { DbCustomer } from "@/pages/CustomersPage";
import { customerSchema } from "@/lib/schemas";
import { zodFieldErrors, focusFirstInvalid } from "@/lib/forms";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useDraftForm } from "@/hooks/useDraftForm";
import { DraftBanner } from "@/components/shared/DraftBanner";
import { CUSTOMER_AUTHORIZATION_PATH } from "@/lib/legal";

interface CustomerModalProps {
  customer?: DbCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<DbCustomer>) => Promise<void>;
}

export function CustomerModal({ customer, open, onOpenChange, onSave }: CustomerModalProps) {
  const isEditing = !!customer;
  const { organization } = useOrganization();

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
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [marketingOptOut, setMarketingOptOut] = useState(true);
  // Ley 1581: autorización del titular para tratar sus datos (obligatoria al crear).
  const [dataConsent, setDataConsent] = useState(false);
  const [notificationChannelOverride, setNotificationChannelOverride] = useState<"" | "sms" | "whatsapp">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Errores inline por campo con el mensaje real de zod (PR-13).
  const [errors, setErrors] = useState<Record<string, string>>({});
  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  useEffect(() => {
    if (customer) {
      setFirstName(customer.first_name);
      setLastName(customer.last_name);
      setEmail(customer.email);
      setPhone(customer.phone);
      setAddress(customer.address || "");
      setCity(customer.city || "");
      setState(customer.state || "");
      setZipCode(customer.zip_code || "");
      setEmergencyContactName(customer.emergency_contact_name || "");
      setEmergencyContactPhone(customer.emergency_contact_phone || "");
      setNotes(customer.notes || "");
      setWhatsappOptIn(!!customer.whatsapp_opt_in);
      setMarketingOptOut(!!customer.marketing_opt_out);
      setDataConsent(!!customer.data_consent_at);
      setNotificationChannelOverride(customer.notification_channel_override ?? "");
    } else {
      setFirstName(""); setLastName(""); setEmail(""); setPhone("");
      setAddress(""); setCity(""); setState(""); setZipCode("");
      setEmergencyContactName(""); setEmergencyContactPhone(""); setNotes("");
      setWhatsappOptIn(false);
      // Publicidad solo con autorización expresa: por defecto, sin campañas.
      setMarketingOptOut(true);
      setDataConsent(false);
      setNotificationChannelOverride("");
    }
    setErrors({});
  }, [customer, open]);

  // Borrador local: si cierran el modal sin guardar (cambio de pestaña/app,
  // Escape, clic afuera), no se pierde lo escrito. Solo para creación.
  const draftKey = organization?.id && !isEditing ? `customerDraft:${organization.id}:new` : null;
  const draftValue = { firstName, lastName, email, phone, address, city, state, zipCode, emergencyContactName, emergencyContactPhone, notes };
  const { hasDraft, clearDraft } = useDraftForm({
    key: draftKey,
    active: open,
    value: draftValue,
    apply: (d) => {
      setFirstName(d.firstName ?? ""); setLastName(d.lastName ?? "");
      setEmail(d.email ?? ""); setPhone(d.phone ?? "");
      setAddress(d.address ?? ""); setCity(d.city ?? ""); setState(d.state ?? ""); setZipCode(d.zipCode ?? "");
      setEmergencyContactName(d.emergencyContactName ?? ""); setEmergencyContactPhone(d.emergencyContactPhone ?? "");
      setNotes(d.notes ?? "");
    },
    isEmpty: (v) => !v.firstName.trim() && !v.lastName.trim() && !v.email.trim() && !v.phone.trim() && !v.notes.trim(),
  });

  const discardDraft = () => {
    clearDraft();
    setFirstName(""); setLastName(""); setEmail(""); setPhone("");
    setAddress(""); setCity(""); setState(""); setZipCode("");
    setEmergencyContactName(""); setEmergencyContactPhone(""); setNotes("");
  };

  const consentAlreadyRecorded = !!customer?.data_consent_at;

  const handleSubmit = async () => {
    if (!isEditing && !dataConsent) {
      setErrors((prev) => ({ ...prev, data_consent: "Confirma que el cliente autorizó el tratamiento de sus datos" }));
      toast.error("Falta la autorización del cliente para tratar sus datos");
      return;
    }
    const candidate = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      address,
      city,
      state,
      zip_code: zipCode,
      notes,
    };
    const parsed = customerSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      focusFirstInvalid();
      toast.error("Revisa los campos marcados");
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    const data = parsed.data;
    await onSave({
      id: customer?.id,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      zip_code: data.zip_code || null,
      emergency_contact_name: emergencyContactName.trim() || null,
      emergency_contact_phone: emergencyContactPhone.trim() || null,
      notes: data.notes || null,
      whatsapp_opt_in: whatsappOptIn,
      marketing_opt_out: marketingOptOut,
      notification_channel_override: notificationChannelOverride || null,
      // La fecha real la fija el servidor (trigger customers_data_consent).
      ...(dataConsent && !consentAlreadyRecorded ? { data_consent_at: new Date().toISOString() } : {}),
    });
    clearDraft();
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
            {isEditing
              ? `Editar información de ${customer.first_name}`
              : "Registrar un nuevo cliente"}
          </DialogDescription>
          {hasDraft && <DraftBanner onDiscard={discardDraft} />}
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cust-first-name">Nombre *</Label>
              <Input id="cust-first-name" value={firstName} onChange={(e) => { setFirstName(e.target.value); clearError("first_name"); }} placeholder="Nombre"
                aria-invalid={errors.first_name ? true : undefined}
                aria-describedby={errors.first_name ? "cust-first-name-error" : undefined}
                className={errors.first_name ? "border-destructive focus-visible:ring-destructive" : ""} />
              {errors.first_name && <p id="cust-first-name-error" className="text-xs text-destructive">{errors.first_name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cust-last-name">Apellido *</Label>
              <Input id="cust-last-name" value={lastName} onChange={(e) => { setLastName(e.target.value); clearError("last_name"); }} placeholder="Apellido"
                aria-invalid={errors.last_name ? true : undefined}
                aria-describedby={errors.last_name ? "cust-last-name-error" : undefined}
                className={errors.last_name ? "border-destructive focus-visible:ring-destructive" : ""} />
              {errors.last_name && <p id="cust-last-name-error" className="text-xs text-destructive">{errors.last_name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cust-email">Email *</Label>
              <Input id="cust-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearError("email"); }} placeholder="correo@ejemplo.com"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? "cust-email-error" : undefined}
                className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""} />
              {errors.email && <p id="cust-email-error" className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cust-phone">Teléfono *</Label>
              <Input id="cust-phone" value={phone} onChange={(e) => { setPhone(e.target.value); clearError("phone"); }} placeholder="+1 555-0000"
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={errors.phone ? "cust-phone-error" : undefined}
                className={errors.phone ? "border-destructive focus-visible:ring-destructive" : ""} />
              {errors.phone && <p id="cust-phone-error" className="text-xs text-destructive">{errors.phone}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Dirección</Label>
              {isEditing && (
                customer.address_lat != null ? (
                  <Badge variant="secondary" className="gap-1 text-xs font-normal">
                    <MapPinCheck className="h-3 w-3" />Dirección verificada
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-xs font-normal text-muted-foreground">
                    <MapPinOff className="h-3 w-3" />No verificada — no disponible para ruta
                  </Badge>
                )
              )}
            </div>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contacto de emergencia</Label>
              <Input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} placeholder="Nombre" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono de emergencia</Label>
              <Input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="+1 555-0000" />
            </div>
          </div>

          <div
            className={`space-y-3 rounded-lg border p-3 ${errors.data_consent ? "border-destructive" : ""}`}
          >
            <Label className="text-sm">Autorizaciones del cliente (Ley 1581 de 2012)</Label>
            {consentAlreadyRecorded ? (
              <p className="text-sm text-muted-foreground">
                Autorización de tratamiento de datos registrada el{" "}
                {new Date(customer!.data_consent_at!).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}.
              </p>
            ) : (
              <div className="flex items-start gap-2">
                <Checkbox
                  id="cust-data-consent"
                  checked={dataConsent}
                  onCheckedChange={(v) => { setDataConsent(!!v); clearError("data_consent"); }}
                  className="mt-0.5"
                  aria-invalid={errors.data_consent ? true : undefined}
                />
                <Label htmlFor="cust-data-consent" className="font-normal cursor-pointer leading-snug">
                  {isEditing ? "" : "* "}Confirmo que el cliente autorizó de forma previa y expresa el tratamiento de sus
                  datos personales y los de su mascota, y que conservamos el soporte (
                  <a href={CUSTOMER_AUTHORIZATION_PATH} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    ver modelo de autorización
                  </a>
                  ).
                </Label>
              </div>
            )}
            {errors.data_consent && <p className="text-xs text-destructive">{errors.data_consent}</p>}
            <div className="flex items-start gap-2">
              <Checkbox
                id="cust-marketing-consent"
                checked={!marketingOptOut}
                onCheckedChange={(v) => setMarketingOptOut(!v)}
                className="mt-0.5"
              />
              <Label htmlFor="cust-marketing-consent" className="font-normal cursor-pointer leading-snug">
                El cliente autorizó recibir promociones y campañas (opcional)
              </Label>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <Label className="text-sm">Notificaciones de ruta</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="cust-whatsapp-opt-in"
                checked={whatsappOptIn}
                onCheckedChange={(v) => setWhatsappOptIn(!!v)}
              />
              <Label htmlFor="cust-whatsapp-opt-in" className="font-normal cursor-pointer">
                El cliente autorizó recibir mensajes de WhatsApp
              </Label>
            </div>
            <div className="space-y-2">
              <Label>Canal preferido (opcional)</Label>
              <Select
                value={notificationChannelOverride || "auto"}
                onValueChange={(v) => setNotificationChannelOverride(v === "auto" ? "" : (v as "sms" | "whatsapp"))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático (según la organización)</SelectItem>
                  <SelectItem value="sms">Siempre SMS</SelectItem>
                  <SelectItem value="whatsapp">Siempre WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales sobre el cliente..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditing ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
