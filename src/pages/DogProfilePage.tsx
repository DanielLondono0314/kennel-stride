import { useState, useEffect } from "react";
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
import { DewormingTab } from "@/components/clinic/DewormingTab";
import { ConditionsTab } from "@/components/clinic/ConditionsTab";
import { TemperamentTab } from "@/components/clinic/TemperamentTab";
import {
  ArrowLeft, Dog, Edit, Calendar, Scale, Palette,
  Syringe, ClipboardList, Activity, BookOpen, Brain,
  Loader2, User,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getAge as getSharedAge } from "@/lib/age";
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
  customer_id: string;
  customers?: { id: string; first_name: string; last_name: string; phone: string | null } | null;
}

interface ReservationRow {
  id: string;
  service_name: string;
  status: string;
  start_date: string;
  total_price: number;
}

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
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const fetchDog = async () => {
    if (!id || !organization) return;
    const { data } = await supabase
      .from("dogs")
      .select("*, customers(id, first_name, last_name, phone)")
      .eq("id", id)
      .eq("organization_id", organization!.id)
      .single();
    if (data) setDog(data as DbDog);
  };

  const fetchReservations = async () => {
    if (!id || !organization) return;
    const { data } = await supabase
      .from("reservations")
      .select("id, service_name, status, start_date, total_price")
      .eq("dog_id", id)
      .eq("organization_id", organization!.id)
      .order("start_date", { ascending: false })
      .limit(20);
    if (data) setReservations(data as ReservationRow[]);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDog(), fetchReservations()]).finally(() => setLoading(false));
  }, [id, organization?.id]);

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
      notes: data.notes || "",
      behavior_notes: data.behavior_notes || "",
      medical_notes: data.medical_notes || "",
      photo_url: data.photo_url ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("dogs").update(payload).eq("id", id!);
    if (error) {
      toast.error("No se pudo guardar", { description: "Revisa tu conexión e inténtalo de nuevo." });
    } else {
      toast.success("Perfil actualizado");
      setEditOpen(false);
      fetchDog();
    }
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
      <Button variant="ghost" size="sm" className="gap-2 -ml-2" onClick={() => orgNavigate("/dogs")}>
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
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
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
                <p className="text-xl font-bold">${totalSpent.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Gasto Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="info">
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
          <TabsTrigger value="deworming" className="gap-1.5">
            <Activity className="h-4 w-4" />Desparasitación
          </TabsTrigger>
          <TabsTrigger value="conditions" className="gap-1.5">
            <BookOpen className="h-4 w-4" />Condiciones
          </TabsTrigger>
          <TabsTrigger value="temperament" className="gap-1.5">
            <Brain className="h-4 w-4" />Temperamento
          </TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="mt-6">
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
              </CardContent>
            </Card>

            <div className="space-y-4">
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
        <TabsContent value="reservations" className="mt-6">
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
                      <span className="text-sm font-medium">${Number(r.total_price).toFixed(2)}</span>
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
        <TabsContent value="vaccinations" className="mt-6">
          <VaccinationTab dogId={dog.id} dogName={dog.name} />
        </TabsContent>
        <TabsContent value="medical" className="mt-6">
          <MedicalHistoryTab dogId={dog.id} dogName={dog.name} />
        </TabsContent>
        <TabsContent value="deworming" className="mt-6">
          <DewormingTab dogId={dog.id} dogName={dog.name} />
        </TabsContent>
        <TabsContent value="conditions" className="mt-6">
          <ConditionsTab dogId={dog.id} dogName={dog.name} />
        </TabsContent>
        <TabsContent value="temperament" className="mt-6">
          <TemperamentTab dogId={dog.id} dogName={dog.name} />
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
