import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { DogModal } from "@/components/dogs/DogModal";
import { DogCharacteristicIcons } from "@/components/dogs/DogCharacteristicIcons";
import { VaccinationTab } from "@/components/clinic/VaccinationTab";
import { MedicalHistoryTab } from "@/components/clinic/MedicalHistoryTab";
import { WeightTab } from "@/components/clinic/WeightTab";
import { DewormingTab } from "@/components/clinic/DewormingTab";
import { ConditionsTab } from "@/components/clinic/ConditionsTab";
import { TemperamentTab } from "@/components/clinic/TemperamentTab";
import {
  ArrowLeft, Dog, Edit, Calendar, Scale, Palette,
  Syringe, ClipboardList, Activity, BookOpen, Brain,
  Loader2, User, Printer, GraduationCap, UtensilsCrossed,
  AlertTriangle, Pill,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getAge as getSharedAge } from "@/lib/age";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";

interface DbDog {
  id: string;
  name: string;
  breed: string;
  gender: string;
  birth_date: string | null;
  weight: number | null;
  color: string | null;
  is_neutered: boolean;
  is_aggressive: boolean;
  has_allergies: boolean;
  on_medication: boolean;
  microchip_number: string | null;
  notes: string | null;
  behavior_notes: string | null;
  medical_notes: string | null;
  photo_url: string | null;
  feeding: {
    food_type?: string;
    brand?: string;
    meals_per_day?: number | string;
    portion_amount?: number | string;
    portion_unit?: string;
    instructions?: string;
  } | null;
  aggression_details: {
    severity?: string;
    handling?: string;
    requires_muzzle?: boolean;
    handle_alone?: boolean;
    no_other_dogs?: boolean;
  } | null;
  customer_id: string;
  preferred_unit_id: string | null;
  customers?: { id: string; first_name: string; last_name: string; phone: string | null } | null;
  facility_units?: { id: string; name: string } | null;
}

interface ReservationRow {
  id: string;
  service_name: string;
  status: string;
  start_date: string;
  total_price: number;
}

interface ReportCardRow {
  id: string;
  session_date: string;
  service_type: string;
  overall_score: number;
  highlights: string | null;
  areas_to_improve: string | null;
  is_sent: boolean;
  staff_members: { first_name: string; last_name: string } | null;
}

interface AllergyRow {
  id: string;
  allergen: string;
  type: string;
  reaction: string | null;
  severity: string | null;
}

interface MedicationRow {
  id: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  duration_days: number | null;
  start_date: string | null;
  route: string | null;
  with_food: boolean;
}

const SEVERITY_LABELS: Record<string, string> = { baja: "Baja", media: "Media", alta: "Alta" };
const ALLERGY_TYPE_LABELS: Record<string, string> = { comida: "Comida", ambiental: "Ambiental", medicamento: "Medicamento" };
const MED_ROUTE_LABELS: Record<string, string> = { oral: "Oral", topica: "Tópica", inyectable: "Inyectable" };

const FOOD_TYPE_LABELS: Record<string, string> = {
  seco: "Seco",
  humedo: "Húmedo",
  crudo: "Crudo",
  mixto: "Mixto",
};

const REPORT_CARD_SERVICE_LABELS: Record<string, string> = {
  daycare: "Guardería",
  board_and_train: "Internado",
  training_session: "Entrenamiento",
  grooming: "Grooming",
  evaluation: "Evaluación",
};

const statusColors: Record<string, string> = {
  completed: "bg-success/10 text-success",
  scheduled: "bg-primary/10 text-primary",
  checked_in: "bg-info/10 text-info",
  cancelled: "bg-destructive/10 text-destructive",
  requested: "bg-warning/10 text-warning",
};

const statusLabels: Record<string, string> = {
  completed: "Completada",
  scheduled: "Programada",
  checked_in: "En el centro",
  cancelled: "Cancelada",
  requested: "Solicitada",
};

export default function DogProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const orgNavigate = useOrgNavigate();

  const [dog, setDog] = useState<DbDog | null>(null);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [reportCards, setReportCards] = useState<ReportCardRow[]>([]);
  const [allergies, setAllergies] = useState<AllergyRow[]>([]);
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const fetchDog = useCallback(async () => {
    if (!id || !organization) return;
    const { data } = await supabase
      .from("dogs")
      .select("*, customers(id, first_name, last_name, phone), facility_units(id, name)")
      .eq("id", id)
      .eq("organization_id", organization!.id)
      .single();
    if (data) setDog(data as DbDog);
  }, [id, organization]);

  const fetchReservations = useCallback(async () => {
    if (!id || !organization) return;
    const { data } = await supabase
      .from("reservations")
      .select("id, service_name, status, start_date, total_price")
      .eq("dog_id", id)
      .eq("organization_id", organization!.id)
      .order("start_date", { ascending: false })
      .limit(20);
    if (data) setReservations(data as ReservationRow[]);
  }, [id, organization]);

  const fetchReportCards = useCallback(async () => {
    if (!id || !organization) return;
    const { data } = await supabase
      .from("report_cards")
      .select("id, session_date, service_type, overall_score, highlights, areas_to_improve, is_sent, staff_members(first_name, last_name)")
      .eq("dog_id", id)
      .eq("organization_id", organization!.id)
      .order("session_date", { ascending: false })
      .limit(20);
    if (data) setReportCards(data as unknown as ReportCardRow[]);
  }, [id, organization]);

  const fetchClinicalDetails = useCallback(async () => {
    if (!id || !organization) return;
    const [aRes, mRes] = await Promise.all([
      supabase.from("dog_allergies").select("id, allergen, type, reaction, severity").eq("dog_id", id).eq("organization_id", organization!.id),
      supabase.from("dog_medications").select("id, name, dose, frequency, duration_days, start_date, route, with_food").eq("dog_id", id).eq("organization_id", organization!.id),
    ]);
    if (aRes.data) setAllergies(aRes.data as AllergyRow[]);
    if (mRes.data) setMedications(mRes.data as MedicationRow[]);
  }, [id, organization]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDog(), fetchReservations(), fetchReportCards(), fetchClinicalDetails()]).finally(() => setLoading(false));
  }, [fetchDog, fetchReservations, fetchReportCards, fetchClinicalDetails]);

  const handleSave = async (data: any) => {
    const payload = {
      customer_id: data.customer_id,
      name: data.name,
      breed: data.breed,
      birth_date: data.birth_date || null,
      weight: data.weight ? parseFloat(data.weight) : null,
      color: data.color || null,
      gender: data.gender,
      is_neutered: data.is_neutered,
      is_aggressive: data.is_aggressive ?? false,
      has_allergies: data.has_allergies ?? false,
      on_medication: data.on_medication ?? false,
      microchip_number: data.microchip_number || null,
      preferred_unit_id: data.preferred_unit_id || null,
      notes: data.notes || "",
      behavior_notes: data.behavior_notes || "",
      medical_notes: data.medical_notes || "",
      photo_url: data.photo_url ?? null,
      feeding: data.feeding ?? null,
      aggression_details: data.is_aggressive ? data.aggression_details ?? null : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("dogs").update(payload).eq("id", id!);
    if (error) {
      toast.error("No se pudo guardar", { description: "Revisa tu conexión e inténtalo de nuevo." });
      return;
    }

    // Sincronizar alergias y medicación (mismo patrón que DogsPage: delete-all + insert).
    const orgId = organization!.id;
    const allergyRows = (data.allergies ?? []).map((a: any) => ({
      dog_id: id!, organization_id: orgId,
      allergen: a.allergen, type: a.type,
      reaction: a.reaction || null, severity: a.severity || null,
    }));
    const medRows = (data.medications ?? []).map((m: any) => ({
      dog_id: id!, organization_id: orgId,
      name: m.name, dose: m.dose || null, frequency: m.frequency || null,
      duration_days: m.duration_days === "" ? null : m.duration_days,
      start_date: m.start_date || null, route: m.route || null,
      with_food: !!m.with_food,
    }));

    const delA = await supabase.from("dog_allergies").delete().eq("dog_id", id!);
    const insA = allergyRows.length ? await supabase.from("dog_allergies").insert(allergyRows) : { error: null };
    const delM = await supabase.from("dog_medications").delete().eq("dog_id", id!);
    const insM = medRows.length ? await supabase.from("dog_medications").insert(medRows) : { error: null };
    const syncError = delA.error || insA.error || delM.error || insM.error;

    setEditOpen(false);
    fetchDog();
    fetchClinicalDetails();

    if (syncError) {
      toast.error("El perro se guardó, pero falló la sincronización clínica", {
        description: "Vuelve a abrir el perro y revisa alergias/medicación.",
      });
      return;
    }
    toast.success("Perfil actualizado");
  };

  const getAge = (birthDate?: string | null) => getSharedAge(birthDate, "Desconocida");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dog) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Dog className="h-12 w-12 mb-4 opacity-50" />
        <p>Perro no encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => orgNavigate("/dogs")}>Volver</Button>
      </div>
    );
  }

  const totalSpent = reservations.filter((r) => r.status === "completed").reduce((s, r) => s + Number(r.total_price), 0);
  const completedCount = reservations.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back */}
      <Button variant="ghost" size="sm" className="gap-2 -ml-2 no-print" onClick={() => orgNavigate("/dogs")}>
        <ArrowLeft className="h-4 w-4" />
        Volver a Perros
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
        <Avatar className="h-24 w-24 border-4 border-background shadow-lg shrink-0">
          {dog.photo_url && (
            <AvatarImage src={dog.photo_url} alt={dog.name} className="object-cover" />
          )}
          <AvatarFallback className="bg-accent text-accent-foreground text-3xl">
            <Dog className="h-12 w-12" />
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{dog.name}</h1>
              <p className="text-muted-foreground">{dog.breed}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary">{dog.gender === "male" ? "♂ Macho" : "♀ Hembra"}</Badge>
                {dog.is_neutered && (
                  <Badge variant="outline">{dog.gender === "male" ? "Castrado" : "Esterilizada"}</Badge>
                )}
                {dog.color && <Badge variant="outline">{dog.color}</Badge>}
              </div>
              <DogCharacteristicIcons
                isAggressive={dog.is_aggressive}
                hasAllergies={dog.has_allergies}
                onMedication={dog.on_medication}
                size="md"
              />
            </div>
            <div className="flex gap-2 no-print">
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </div>
          </div>

          {dog.customers && (
            <div className="flex items-center gap-1.5 mt-3 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <button
                className="hover:text-foreground hover:underline transition-colors"
                onClick={() => orgNavigate(`/customers/${dog.customer_id}`)}
              >
                {dog.customers.first_name} {dog.customers.last_name}
              </button>
              {dog.customers.phone && <span>· {dog.customers.phone}</span>}
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Calendar className="h-4 w-4 text-primary" /></div>
              <div>
                <p className="text-xl font-bold">{getAge(dog.birth_date)}</p>
                <p className="text-xs text-muted-foreground">Edad</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/20"><Scale className="h-4 w-4 text-accent-foreground" /></div>
              <div>
                <p className="text-xl font-bold">{dog.weight ? `${dog.weight} kg` : "—"}</p>
                <p className="text-xs text-muted-foreground">Peso</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10"><Activity className="h-4 w-4 text-success" /></div>
              <div>
                <p className="text-xl font-bold">{completedCount}</p>
                <p className="text-xs text-muted-foreground">Visitas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10"><Palette className="h-4 w-4 text-warning" /></div>
              <div>
                <p className="text-xl font-bold">{formatCurrency(totalSpent)}</p>
                <p className="text-xs text-muted-foreground">Gasto Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="info" className="print-all-tabs">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="info" className="gap-1.5">
            <Dog className="h-4 w-4" />Info
          </TabsTrigger>
          <TabsTrigger value="reservations" className="gap-1.5">
            <Calendar className="h-4 w-4" />Reservas
          </TabsTrigger>
          <TabsTrigger value="vaccinations" className="gap-1.5">
            <Syringe className="h-4 w-4" />Vacunas
          </TabsTrigger>
          <TabsTrigger value="medical" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />Historial
          </TabsTrigger>
          <TabsTrigger value="weight" className="gap-1.5">
            <Scale className="h-4 w-4" />Peso
          </TabsTrigger>
          <TabsTrigger value="deworming" className="gap-1.5">
            <Activity className="h-4 w-4" />Desparasitación
          </TabsTrigger>
          <TabsTrigger value="conditions" className="gap-1.5">
            <BookOpen className="h-4 w-4" />Condiciones
          </TabsTrigger>
          <TabsTrigger value="temperament" className="gap-1.5">
            <Brain className="h-4 w-4" />Temperamento
          </TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5">
            <GraduationCap className="h-4 w-4" />Entrenamiento
          </TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="mt-6" forceMount>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="pt-4 space-y-3 text-sm">
                <p className="font-semibold text-base mb-2">Información Básica</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Raza</span>
                  <span className="font-medium">{dog.breed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha de nacimiento</span>
                  <span className="font-medium">
                    {dog.birth_date
                      ? format(new Date(dog.birth_date), "d MMM yyyy", { locale: es })
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Género</span>
                  <span className="font-medium">{dog.gender === "male" ? "Macho" : "Hembra"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Castrado/Esterilizado</span>
                  <span className="font-medium">{dog.is_neutered ? "Sí" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Peso</span>
                  <span className="font-medium">{dog.weight ? `${dog.weight} kg` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Color</span>
                  <span className="font-medium">{dog.color || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Microchip</span>
                  <span className="font-medium font-mono text-xs">{dog.microchip_number || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Perrera preferida</span>
                  <span className="font-medium">{dog.facility_units?.name || "Sin asignar"}</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {dog.feeding && (dog.feeding.food_type || dog.feeding.brand || dog.feeding.meals_per_day) && (
                <Card>
                  <CardContent className="pt-4 space-y-3 text-sm">
                    <p className="font-semibold mb-2 flex items-center gap-2">
                      <UtensilsCrossed className="h-4 w-4" />Alimentación
                    </p>
                    {dog.feeding.food_type && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tipo de comida</span>
                        <span className="font-medium capitalize">{FOOD_TYPE_LABELS[dog.feeding.food_type] || dog.feeding.food_type}</span>
                      </div>
                    )}
                    {dog.feeding.brand && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Marca</span>
                        <span className="font-medium">{dog.feeding.brand}</span>
                      </div>
                    )}
                    {dog.feeding.meals_per_day && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Comidas al día</span>
                        <span className="font-medium">{dog.feeding.meals_per_day}</span>
                      </div>
                    )}
                    {dog.feeding.portion_amount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Porción</span>
                        <span className="font-medium">{dog.feeding.portion_amount} {dog.feeding.portion_unit || ""}</span>
                      </div>
                    )}
                    {dog.feeding.instructions && (
                      <p className="text-muted-foreground whitespace-pre-wrap pt-1 border-t">{dog.feeding.instructions}</p>
                    )}
                  </CardContent>
                </Card>
              )}
              {dog.is_aggressive && dog.aggression_details && (
                <Card className="border-destructive/30">
                  <CardContent className="pt-4 space-y-3 text-sm">
                    <p className="font-semibold mb-2 flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />Agresividad
                    </p>
                    {dog.aggression_details.severity && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Severidad</span>
                        <span className="font-medium">{SEVERITY_LABELS[dog.aggression_details.severity] || dog.aggression_details.severity}</span>
                      </div>
                    )}
                    {(dog.aggression_details.requires_muzzle || dog.aggression_details.handle_alone || dog.aggression_details.no_other_dogs) && (
                      <div className="flex flex-wrap gap-1.5">
                        {dog.aggression_details.requires_muzzle && <Badge variant="destructive" className="text-xs">Requiere bozal</Badge>}
                        {dog.aggression_details.handle_alone && <Badge variant="destructive" className="text-xs">Manejar solo</Badge>}
                        {dog.aggression_details.no_other_dogs && <Badge variant="destructive" className="text-xs">Sin otros perros</Badge>}
                      </div>
                    )}
                    {dog.aggression_details.handling && (
                      <p className="text-muted-foreground whitespace-pre-wrap pt-1 border-t">{dog.aggression_details.handling}</p>
                    )}
                  </CardContent>
                </Card>
              )}
              {allergies.length > 0 && (
                <Card className="border-warning/30">
                  <CardContent className="pt-4 space-y-3 text-sm">
                    <p className="font-semibold mb-2 flex items-center gap-2 text-warning">
                      <AlertTriangle className="h-4 w-4" />Alergias
                    </p>
                    {allergies.map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-2 pb-2 border-b last:border-0 last:pb-0">
                        <div>
                          <p className="font-medium">{a.allergen}</p>
                          <p className="text-xs text-muted-foreground">
                            {ALLERGY_TYPE_LABELS[a.type] || a.type}
                            {a.reaction && ` · ${a.reaction}`}
                          </p>
                        </div>
                        {a.severity && (
                          <Badge variant="outline" className="text-xs shrink-0">{SEVERITY_LABELS[a.severity] || a.severity}</Badge>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {medications.length > 0 && (
                <Card>
                  <CardContent className="pt-4 space-y-3 text-sm">
                    <p className="font-semibold mb-2 flex items-center gap-2">
                      <Pill className="h-4 w-4" />Medicación
                    </p>
                    {medications.map((m) => (
                      <div key={m.id} className="pb-2 border-b last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{m.name}</p>
                          {m.with_food && <Badge variant="outline" className="text-xs">Con comida</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {[m.dose, m.frequency, m.route && MED_ROUTE_LABELS[m.route]].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {dog.notes && (
                <Card>
                  <CardContent className="pt-4 text-sm">
                    <p className="font-semibold mb-2">Notas Generales</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{dog.notes}</p>
                  </CardContent>
                </Card>
              )}
              {dog.behavior_notes && (
                <Card>
                  <CardContent className="pt-4 text-sm">
                    <p className="font-semibold mb-2">Comportamiento</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{dog.behavior_notes}</p>
                  </CardContent>
                </Card>
              )}
              {dog.medical_notes && (
                <Card>
                  <CardContent className="pt-4 text-sm">
                    <p className="font-semibold mb-2">Notas Médicas</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{dog.medical_notes}</p>
                  </CardContent>
                </Card>
              )}
              {!dog.notes && !dog.behavior_notes && !dog.medical_notes && (
                <Card>
                  <CardContent className="pt-4 text-sm text-muted-foreground">
                    Sin notas registradas.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Reservations Tab */}
        <TabsContent value="reservations" className="mt-6" forceMount>
          {reservations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mb-4 opacity-50" />
                <p>Sin reservas registradas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {reservations.map((r) => (
                <Card key={r.id}>
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.service_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(r.start_date), "d MMM yyyy · HH:mm", { locale: es })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{formatCurrency(r.total_price)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[r.status] || "bg-muted text-muted-foreground"}`}>
                        {statusLabels[r.status] || r.status}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Clinic tabs — reuse existing components */}
        <TabsContent value="vaccinations" className="mt-6" forceMount>
          <VaccinationTab dogId={dog.id} dogName={dog.name} />
        </TabsContent>
        <TabsContent value="medical" className="mt-6" forceMount>
          <MedicalHistoryTab dogId={dog.id} dogName={dog.name} />
        </TabsContent>
        <TabsContent value="weight" className="mt-6" forceMount>
          <WeightTab dogId={dog.id} dogName={dog.name} />
        </TabsContent>
        <TabsContent value="deworming" className="mt-6" forceMount>
          <DewormingTab dogId={dog.id} dogName={dog.name} />
        </TabsContent>
        <TabsContent value="conditions" className="mt-6" forceMount>
          <ConditionsTab dogId={dog.id} dogName={dog.name} />
        </TabsContent>
        <TabsContent value="temperament" className="mt-6" forceMount>
          <TemperamentTab dogId={dog.id} dogName={dog.name} />
        </TabsContent>

        {/* Training / Report Cards Tab */}
        <TabsContent value="training" className="mt-6" forceMount>
          {reportCards.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <GraduationCap className="h-12 w-12 mb-4 opacity-50" />
                <p>Sin sesiones de entrenamiento registradas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {reportCards.map((rc) => (
                <Card key={rc.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">
                          {REPORT_CARD_SERVICE_LABELS[rc.service_type] || rc.service_type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(rc.session_date), "d MMM yyyy", { locale: es })}
                          {rc.staff_members && ` · ${rc.staff_members.first_name} ${rc.staff_members.last_name}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">{rc.overall_score}/5</Badge>
                        <Badge variant={rc.is_sent ? "default" : "secondary"} className="text-xs">
                          {rc.is_sent ? "Enviado" : "Borrador"}
                        </Badge>
                      </div>
                    </div>
                    {rc.highlights && (
                      <p className="text-sm text-muted-foreground mt-2">✨ {rc.highlights}</p>
                    )}
                    {rc.areas_to_improve && (
                      <p className="text-sm text-muted-foreground mt-1">📋 {rc.areas_to_improve}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <DogModal
        dog={dog}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleSave}
      />
    </div>
  );
}
