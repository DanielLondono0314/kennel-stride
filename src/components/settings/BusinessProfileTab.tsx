import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Clock, MapPin, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface OrgFields {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  opening_time: string;
  closing_time: string;
  timezone: string;
  service_types: Array<{ value: string; label: string }>;
}

function toSlug(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const timezones = [
  { value: "America/New_York", label: "Este (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Montaña (MT)" },
  { value: "America/Los_Angeles", label: "Pacífico (PT)" },
  { value: "America/Mexico_City", label: "Ciudad de México (CST)" },
];

export function BusinessProfileTab() {
  const { organization, isAdmin, refetch } = useOrganization();
  const [fields, setFields] = useState<OrgFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [newServiceLabel, setNewServiceLabel] = useState("");

  useEffect(() => {
    if (!organization) return;
    setFields({
      name:         organization.name,
      address:      organization.address      ?? "",
      city:         organization.city         ?? "",
      phone:        organization.phone        ?? "",
      email:        organization.email        ?? "",
      opening_time: organization.opening_time ?? "07:00",
      closing_time: organization.closing_time ?? "19:00",
      timezone:     organization.timezone     ?? "America/Mexico_City",
      service_types: organization.service_types?.length
        ? organization.service_types
        : [
            { value: "daycare", label: "Guardería" },
            { value: "board_and_train", label: "Internado + Entrenamiento" },
            { value: "training_session", label: "Sesión de Entrenamiento" },
            { value: "grooming", label: "Grooming" },
            { value: "evaluation", label: "Evaluación" },
          ],
    });
  }, [organization?.id]);

  const handleSave = async () => {
    if (!fields || !organization) return;
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        name:         fields.name,
        address:      fields.address      || null,
        city:         fields.city         || null,
        phone:        fields.phone        || null,
        email:        fields.email        || null,
        opening_time: fields.opening_time,
        closing_time: fields.closing_time,
        timezone:     fields.timezone,
        service_types: fields.service_types,
        updated_at:   new Date().toISOString(),
      })
      .eq("id", organization.id);

    if (error) {
      toast.error("Error al guardar");
    } else {
      toast.success("Perfil del negocio actualizado");
      refetch();
    }
    setSaving(false);
  };

  const update = (field: keyof OrgFields, value: string) => {
    setFields((prev) => prev ? { ...prev, [field]: value } : null);
  };

  if (!fields) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Información General
          </CardTitle>
          <CardDescription>Datos principales de tu centro de adiestramiento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="biz-name">Nombre del negocio</Label>
            <Input id="biz-name" value={fields.name} onChange={(e) => update("name", e.target.value)} disabled={!isAdmin} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="biz-email">Email</Label>
              <Input id="biz-email" type="email" value={fields.email} onChange={(e) => update("email", e.target.value)} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-phone">Teléfono</Label>
              <Input id="biz-phone" value={fields.phone} onChange={(e) => update("phone", e.target.value)} disabled={!isAdmin} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Dirección
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="biz-address">Dirección</Label>
            <Input id="biz-address" value={fields.address} onChange={(e) => update("address", e.target.value)} disabled={!isAdmin} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="biz-city">Ciudad</Label>
            <Input id="biz-city" value={fields.city} onChange={(e) => update("city", e.target.value)} disabled={!isAdmin} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horarios de Operación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="biz-open">Apertura</Label>
              <Input id="biz-open" type="time" value={fields.opening_time} onChange={(e) => update("opening_time", e.target.value)} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-close">Cierre</Label>
              <Input id="biz-close" type="time" value={fields.closing_time} onChange={(e) => update("closing_time", e.target.value)} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-tz">Zona horaria</Label>
              <Select value={fields.timezone} onValueChange={(v) => update("timezone", v)} disabled={!isAdmin}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipos de Servicio</CardTitle>
          <CardDescription>
            Personaliza los servicios que ofrece tu centro. Se usan en report cards y reservas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            {fields.service_types.map((st, i) => (
              <div
                key={st.value}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50"
              >
                <span className="text-sm">{st.label}</span>
                {isAdmin && fields.service_types.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-destructive hover:underline"
                    onClick={() =>
                      setFields((prev) =>
                        prev
                          ? { ...prev, service_types: prev.service_types.filter((_, idx) => idx !== i) }
                          : null
                      )
                    }
                  >
                    Eliminar
                  </button>
                )}
              </div>
            ))}
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Input
                placeholder="Nuevo servicio (ej. Spa canino)"
                value={newServiceLabel}
                onChange={(e) => setNewServiceLabel(e.target.value)}
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!newServiceLabel.trim()) return;
                    const slug = toSlug(newServiceLabel.trim());
                    setFields((prev) => {
                      if (!prev) return null;
                      if (prev.service_types.some(st => st.value === slug)) {
                        toast.error("Ya existe un servicio con ese nombre");
                        return prev;
                      }
                      return {
                        ...prev,
                        service_types: [
                          ...prev.service_types,
                          { value: slug, label: newServiceLabel.trim() },
                        ],
                      };
                    });
                    setNewServiceLabel("");
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!newServiceLabel.trim()}
                onClick={() => {
                  if (!newServiceLabel.trim()) return;
                  const slug = toSlug(newServiceLabel.trim());
                  setFields((prev) => {
                    if (!prev) return null;
                    if (prev.service_types.some(st => st.value === slug)) {
                      toast.error("Ya existe un servicio con ese nombre");
                      return prev;
                    }
                    return {
                      ...prev,
                      service_types: [
                        ...prev.service_types,
                        { value: slug, label: newServiceLabel.trim() },
                      ],
                    };
                  });
                  setNewServiceLabel("");
                }}
              >
                Agregar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar cambios
          </Button>
        </div>
      )}
      {!isAdmin && (
        <p className="text-sm text-muted-foreground text-right">
          Solo los administradores pueden modificar la configuración del negocio.
        </p>
      )}
    </div>
  );
}
