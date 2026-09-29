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

/** Ficha del perro en la vista del trabajador (celular primero). */
export default function WorkerDogPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: dog, isLoading } = useWorkerDogProfile(id);
  const canRecordWeight = usePermission("record_weight");
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
