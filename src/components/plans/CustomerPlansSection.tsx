import { useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlansForDogs } from "@/hooks/queries/useDogPlans";
import { usePermission } from "@/hooks/usePermission";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";
import { isCurrent, planState } from "@/lib/dogPlans";
import { AssignPlanDialog } from "./AssignPlanDialog";
import { PlanCard } from "./PlanCard";

/** Planes de los perros de un cliente (vigentes arriba) y asignar uno nuevo. */
export function CustomerPlansSection({ dogs }: { dogs: { id: string; name: string }[] }) {
  const base = useOrgBasePath();
  const { data: plans = [], isLoading } = usePlansForDogs(dogs.map((d) => d.id));
  const canSell = usePermission("plans.sell");
  const [assignOpen, setAssignOpen] = useState(false);

  const nameById = new Map(dogs.map((d) => [d.id, d.name]));
  const sorted = [...plans].sort((a, b) => Number(isCurrent(planState(b))) - Number(isCurrent(planState(a))));

  return (
    <div className="space-y-3">
      {canSell && dogs.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Asignar plan
          </Button>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-24" />
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <ClipboardList className="h-10 w-10" aria-hidden />
          <p>{dogs.length === 0 ? "Registra una mascota para asignarle un plan." : "Ningún perro de este cliente tiene planes."}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((plan) => (
            <Card key={plan.id} className={isCurrent(planState(plan)) ? undefined : "opacity-70"}>
              <CardContent className="space-y-2 p-4">
                <Link to={`${base}/dogs/${plan.dog_id}?tab=plan`} className="text-sm font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
                  {nameById.get(plan.dog_id) ?? "Perro"}
                </Link>
                <PlanCard plan={plan} compact />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AssignPlanDialog open={assignOpen} onOpenChange={setAssignOpen} dogs={dogs} />
    </div>
  );
}
