import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Brain, Save } from "lucide-react";
import { toast } from "sonner";

interface Props {
  dogId: string;
  dogName: string;
}

const traits = [
  { key: "energy_level", label: "Nivel de Energía", low: "Bajo", high: "Muy alto" },
  { key: "sociability_dogs", label: "Sociabilidad con Perros", low: "Reactivo", high: "Muy sociable" },
  { key: "sociability_people", label: "Sociabilidad con Personas", low: "Tímido", high: "Muy sociable" },
  { key: "anxiety_level", label: "Nivel de Ansiedad", low: "Calmado", high: "Muy ansioso" },
  { key: "aggression_level", label: "Nivel de Agresividad", low: "Nulo", high: "Alto" },
  { key: "trainability", label: "Entrenabilidad", low: "Difícil", high: "Muy fácil" },
  { key: "noise_sensitivity", label: "Sensibilidad al Ruido", low: "Tolerante", high: "Muy sensible" },
  { key: "prey_drive", label: "Instinto de Presa", low: "Bajo", high: "Alto" },
];

export function TemperamentTab({ dogId, dogName }: Props) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({
    energy_level: 3,
    sociability_dogs: 3,
    sociability_people: 3,
    anxiety_level: 2,
    aggression_level: 1,
    trainability: 3,
    noise_sensitivity: 2,
    prey_drive: 2,
    general_notes: "",
    behavioral_alerts: "",
  });

  const fetchProfile = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("dog_temperament")
      .select("*")
      .eq("dog_id", dogId)
      .maybeSingle();
    if (data) {
      setProfile(data);
      setForm({
        energy_level: data.energy_level,
        sociability_dogs: data.sociability_dogs,
        sociability_people: data.sociability_people,
        anxiety_level: data.anxiety_level,
        aggression_level: data.aggression_level,
        trainability: data.trainability,
        noise_sensitivity: data.noise_sensitivity,
        prey_drive: data.prey_drive,
        general_notes: data.general_notes || "",
        behavioral_alerts: data.behavioral_alerts || "",
      });
    }
    setLoading(false);
  };

  useEffect(() => { fetchProfile(); }, [dogId]);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      dog_id: dogId,
      dog_name: dogName,
      ...form,
      last_evaluation_date: new Date().toISOString().split("T")[0],
      updated_at: new Date().toISOString(),
    };

    let error;
    if (profile) {
      ({ error } = await supabase.from("dog_temperament").update(payload).eq("id", profile.id));
    } else {
      ({ error } = await supabase.from("dog_temperament").insert(payload));
    }

    if (error) {
      toast.error("Error al guardar perfil de temperamento");
    } else {
      toast.success("Perfil de temperamento guardado");
      fetchProfile();
    }
    setSaving(false);
  };

  if (loading) return <p className="text-muted-foreground text-sm mt-4">Cargando...</p>;

  return (
    <div className="mt-4 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Perfil de Temperamento</h3>
        <Button onClick={handleSave} size="sm" disabled={saving}>
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {traits.map((trait) => (
            <div key={trait.key}>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">{trait.label}</Label>
                <span className="text-sm font-semibold text-primary">{form[trait.key]}/5</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-20 text-right">{trait.low}</span>
                <Slider
                  value={[form[trait.key]]}
                  onValueChange={([v]) => setForm({ ...form, [trait.key]: v })}
                  min={1}
                  max={5}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-24">{trait.high}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Notas Generales</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.general_notes}
              onChange={(e) => setForm({ ...form, general_notes: e.target.value })}
              placeholder="Observaciones sobre el comportamiento general del perro..."
              rows={4}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-destructive flex items-center gap-1.5">
              <Brain className="h-4 w-4" /> Alertas de Comportamiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.behavioral_alerts}
              onChange={(e) => setForm({ ...form, behavioral_alerts: e.target.value })}
              placeholder="Alertas importantes: agresividad, miedos, triggers..."
              rows={4}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
