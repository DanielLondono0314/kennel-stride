import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkerDogProfile } from "@/hooks/queries/useWorkerDogs";
import { useLatestDogWeight } from "@/hooks/queries/useDogWeightLog";
import { usePermission } from "@/hooks/usePermission";
import { WeightEntryDialog } from "@/components/weight/WeightEntryDialog";
import { WorkerDogHeader, WorkerDogInfo } from "@/components/worker/dogs/WorkerDogInfo";
import { WelfareHistory } from "@/components/worker/dogs/WelfareHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VaccinationTab } from "@/components/clinic/VaccinationTab";
import { DewormingTab } from "@/components/clinic/DewormingTab";
import { MedicalHistoryTab } from "@/components/clinic/MedicalHistoryTab";
import { ConditionsTab } from "@/components/clinic/ConditionsTab";
import { WeightTab } from "@/components/clinic/WeightTab";
import { TemperamentTab } from "@/components/clinic/TemperamentTab";
import { useUrlState } from "@/hooks/useUrlState";
import { ClinicalGate } from "@/components/clinic/ClinicalGate";

/** Ficha del perro en la vista del trabajador (celular primero). */
export default function WorkerDogPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: dog, isLoading } = useWorkerDogProfile(id);
  const canRecordWeight = usePermission("weight.record");
  // Todos ven la parte clínica; registrar/editar exige "Registros clínicos".
  const canClinical = usePermission("clinical.edit");
  const [healthTab, setHealthTab] = useUrlState<string>("salud", "vacunas", { replace: true });
  const { data: lastWeight } = useLatestDogWeight(dog?.id);
  const [weighing, setWeighing] = useState(false);

  const back = (
    <Button variant="ghost" size="sm" className="-ml-2 gap-1" onClick={() => navigate(-1)}>
      <ArrowLeft className="h-4 w-4" /> Volver
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-20" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!dog) {
    return (
      <div className="space-y-4">
        {back}
        <p className="text-sm text-muted-foreground">No se encontró el perro.</p>
      </div>
    );
  }

  const weight = lastWeight ?? dog.weight;

  return (
    <div className="space-y-4">
      {back}
      <WorkerDogHeader dog={dog} />

      <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
        <span className="text-muted-foreground">Peso</span>
        <div className="flex items-center gap-3">
          <span className="font-semibold">{weight ? `${weight.toLocaleString("es")} kg` : "Sin registro"}</span>
          {canRecordWeight && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setWeighing(true)}>
              <Scale className="h-4 w-4" /> Registrar
            </Button>
          )}
        </div>
      </div>

      <WorkerDogInfo dog={dog} />

      {/* Salud y bienestar: lo mismo que Clínica en el panel, en solo lectura
          para quien no tiene el permiso "Registros clínicos". */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Salud y bienestar</h2>
        <Tabs value={healthTab} onValueChange={setHealthTab}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="vacunas">Vacunas</TabsTrigger>
            <TabsTrigger value="desparasitacion">Desparasitación</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="condiciones">Condiciones</TabsTrigger>
            <TabsTrigger value="peso">Peso</TabsTrigger>
            <TabsTrigger value="temperamento">Temperamento</TabsTrigger>
            <TabsTrigger value="bienestar">Rondas</TabsTrigger>
          </TabsList>
          <TabsContent value="vacunas"><ClinicalGate><VaccinationTab dogId={dog.id} dogName={dog.name} readOnly={!canClinical} /></ClinicalGate></TabsContent>
          <TabsContent value="desparasitacion"><ClinicalGate><DewormingTab dogId={dog.id} dogName={dog.name} readOnly={!canClinical} /></ClinicalGate></TabsContent>
          <TabsContent value="historial"><ClinicalGate><MedicalHistoryTab dogId={dog.id} dogName={dog.name} readOnly={!canClinical} /></ClinicalGate></TabsContent>
          <TabsContent value="condiciones"><ConditionsTab dogId={dog.id} dogName={dog.name} readOnly={!canClinical} /></TabsContent>
          <TabsContent value="peso"><WeightTab dogId={dog.id} dogName={dog.name} /></TabsContent>
          <TabsContent value="temperamento"><TemperamentTab dogId={dog.id} dogName={dog.name} /></TabsContent>
          <TabsContent value="bienestar" className="mt-4"><WelfareHistory dogId={dog.id} /></TabsContent>
        </Tabs>
      </section>

      <WeightEntryDialog
        open={weighing}
        onOpenChange={setWeighing}
        dogId={dog.id}
        dogName={dog.name}
        lastWeight={lastWeight ?? null}
      />
    </div>
  );
}
