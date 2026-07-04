import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Stethoscope, Syringe, Bug, AlertTriangle,
  Brain, FileText, ChevronRight, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { MedicalHistoryTab } from "@/components/clinic/MedicalHistoryTab";
import { VaccinationTab } from "@/components/clinic/VaccinationTab";
import { DewormingTab } from "@/components/clinic/DewormingTab";
import { ConditionsTab } from "@/components/clinic/ConditionsTab";
import { TemperamentTab } from "@/components/clinic/TemperamentTab";

interface DbDog {
  id: string;
  customer_id: string;
  name: string;
  breed: string;
  birth_date: string | null;
  weight: number | null;
  gender: string;
  is_neutered: boolean;
  customers?: { first_name: string; last_name: string } | null;
}

export default function ClinicPage() {
  const { organization } = useOrganization();
  const [selectedDogId, setSelectedDogId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dogs, setDogs] = useState<DbDog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDogs = async () => {
      if (!organization) return;
      setLoading(true);
      const { data } = await supabase
        .from("dogs")
        .select("id, customer_id, name, breed, birth_date, weight, gender, is_neutered, customers(first_name, last_name)")
        .eq("organization_id", organization!.id)
        .order("name");
      if (data) setDogs(data);
      setLoading(false);
    };
    fetchDogs();
  }, [organization?.id]);

  const filteredDogs = useMemo(() => {
    if (!searchQuery) return dogs;
    const q = searchQuery.toLowerCase();
    return dogs.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.breed.toLowerCase().includes(q) ||
        d.customers?.first_name.toLowerCase().includes(q) ||
        d.customers?.last_name.toLowerCase().includes(q)
    );
  }, [dogs, searchQuery]);

  const selectedDog = dogs.find((d) => d.id === selectedDogId);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Dog list sidebar — hidden on mobile when a dog is selected */}
      <div className={`w-full md:w-80 border-r border-border bg-card flex flex-col ${selectedDogId ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Clínica Veterinaria
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar perro..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredDogs.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No hay perros registrados.</p>
          ) : filteredDogs.map((dog) => (
            <button
              key={dog.id}
              onClick={() => setSelectedDogId(dog.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50 ${
                selectedDogId === dog.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
              }`}
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {dog.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{dog.name}</p>
                <p className="text-xs text-muted-foreground truncate">{dog.breed}</p>
                <p className="text-xs text-muted-foreground truncate">
                  Dueño: {dog.customers?.first_name} {dog.customers?.last_name}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Main content — hidden on mobile when no dog selected */}
      <div className={`flex-1 overflow-y-auto ${!selectedDogId ? "hidden md:flex md:flex-col" : "flex flex-col"}`}>
        {!selectedDog ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 mb-4 rounded-2xl bg-muted flex items-center justify-center">
              <Stethoscope className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Historia Clínica</h2>
            <p className="text-muted-foreground max-w-md">
              Selecciona un perro del panel izquierdo para ver y gestionar su historial médico completo.
            </p>
          </div>
        ) : (
          <div className="p-4 md:p-6">
            {/* Back button — mobile only */}
            <Button
              variant="ghost"
              size="sm"
              className="mb-4 md:hidden -ml-1"
              onClick={() => setSelectedDogId("")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver a la lista
            </Button>
            {/* Dog header */}
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {selectedDog.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{selectedDog.name}</h1>
                <p className="text-muted-foreground">
                  {selectedDog.breed} · {selectedDog.gender === "male" ? "Macho" : "Hembra"} ·{" "}
                  {selectedDog.weight ? `${selectedDog.weight} kg` : "Peso no registrado"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Dueño: {selectedDog.customers?.first_name} {selectedDog.customers?.last_name}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="history" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="history" className="text-xs sm:text-sm">
                  <FileText className="h-4 w-4 mr-1.5 hidden sm:inline" />
                  Historial
                </TabsTrigger>
                <TabsTrigger value="vaccines" className="text-xs sm:text-sm">
                  <Syringe className="h-4 w-4 mr-1.5 hidden sm:inline" />
                  Vacunas
                </TabsTrigger>
                <TabsTrigger value="deworming" className="text-xs sm:text-sm">
                  <Bug className="h-4 w-4 mr-1.5 hidden sm:inline" />
                  Desparasitación
                </TabsTrigger>
                <TabsTrigger value="conditions" className="text-xs sm:text-sm">
                  <AlertTriangle className="h-4 w-4 mr-1.5 hidden sm:inline" />
                  Condiciones
                </TabsTrigger>
                <TabsTrigger value="temperament" className="text-xs sm:text-sm">
                  <Brain className="h-4 w-4 mr-1.5 hidden sm:inline" />
                  Temperamento
                </TabsTrigger>
              </TabsList>

              <TabsContent value="history">
                <MedicalHistoryTab dogId={selectedDog.id} dogName={selectedDog.name} />
              </TabsContent>
              <TabsContent value="vaccines">
                <VaccinationTab dogId={selectedDog.id} dogName={selectedDog.name} />
              </TabsContent>
              <TabsContent value="deworming">
                <DewormingTab dogId={selectedDog.id} dogName={selectedDog.name} />
              </TabsContent>
              <TabsContent value="conditions">
                <ConditionsTab dogId={selectedDog.id} dogName={selectedDog.name} />
              </TabsContent>
              <TabsContent value="temperament">
                <TemperamentTab dogId={selectedDog.id} dogName={selectedDog.name} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
