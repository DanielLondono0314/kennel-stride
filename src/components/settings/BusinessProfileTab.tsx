import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Clock, MapPin, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BusinessData {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  email: string;
  opening_time: string;
  closing_time: string;
  timezone: string;
}

const timezones = [
  { value: "America/New_York", label: "Este (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Montaña (MT)" },
  { value: "America/Los_Angeles", label: "Pacífico (PT)" },
  { value: "America/Mexico_City", label: "Ciudad de México (CST)" },
];

export function BusinessProfileTab() {
  const [data, setData] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBusiness();
  }, []);

  const fetchBusiness = async () => {
    const { data: rows, error } = await supabase
      .from("business_profile")
      .select("*")
      .limit(1);
    if (error) {
      toast.error("Error al cargar perfil del negocio");
      console.error(error);
    } else if (rows && rows.length > 0) {
      const row = rows[0];
      setData({
        id: row.id,
        name: row.name,
        address: row.address || "",
        city: row.city || "",
        state: row.state || "",
        zip_code: row.zip_code || "",
        phone: row.phone || "",
        email: row.email || "",
        opening_time: row.opening_time || "07:00",
        closing_time: row.closing_time || "19:00",
        timezone: row.timezone || "America/Mexico_City",
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    const { error } = await supabase
      .from("business_profile")
      .update({
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        zip_code: data.zip_code,
        phone: data.phone,
        email: data.email,
        opening_time: data.opening_time,
        closing_time: data.closing_time,
        timezone: data.timezone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (error) {
      toast.error("Error al guardar");
      console.error(error);
    } else {
      toast.success("Perfil del negocio actualizado");
    }
    setSaving(false);
  };

  const update = (field: keyof BusinessData, value: string) => {
    setData(prev => prev ? { ...prev, [field]: value } : null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground py-8 text-center">No se encontró perfil del negocio.</p>;
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
            <Input id="biz-name" value={data.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="biz-email">Email</Label>
              <Input id="biz-email" type="email" value={data.email} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-phone">Teléfono</Label>
              <Input id="biz-phone" value={data.phone} onChange={(e) => update("phone", e.target.value)} />
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
            <Input id="biz-address" value={data.address} onChange={(e) => update("address", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="biz-city">Ciudad</Label>
              <Input id="biz-city" value={data.city} onChange={(e) => update("city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-state">Estado</Label>
              <Input id="biz-state" value={data.state} onChange={(e) => update("state", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-zip">Código postal</Label>
              <Input id="biz-zip" value={data.zip_code} onChange={(e) => update("zip_code", e.target.value)} />
            </div>
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
              <Input id="biz-open" type="time" value={data.opening_time} onChange={(e) => update("opening_time", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-close">Cierre</Label>
              <Input id="biz-close" type="time" value={data.closing_time} onChange={(e) => update("closing_time", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-tz">Zona horaria</Label>
              <Select value={data.timezone} onValueChange={(v) => update("timezone", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
