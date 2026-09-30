import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCheck, ClipboardList, Plus, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDogPlans, usePlanActions } from "@/hooks/queries/useDogPlans";
import { usePermission } from "@/hooks/usePermission";
import { parseDateOnly, todayLocal } from "@/lib/age";
import { isCurrent, planState, remainingUnits, type DogPlan } from "@/lib/dogPlans";
import { AssignPlanDialog } from "./AssignPlanDialog";
import { PlanCard } from "./PlanCard";

/** Planes del perro: el actual con sus acciones y el historial. */
export function DogPlansSection({ dogId, dogName }: { dogId: string; dogName: string }) {
  const { data: plans = [], isLoading } = useDogPlans(dogId);
  const { end, registerUsage } = usePlanActions();
  const canSchedule = usePermission("schedule");
  const canBill = usePermission("billing");
  const canManage = canSchedule || canBill;
  const [assignOpen, setAssignOpen] = useState(false);
  const [renewFrom, setRenewFrom] = useState<DogPlan | null>(null);
  const [usagePlan, setUsagePlan] = useState<DogPlan | null>(null);
  const [usage, setUsage] = useState({ quantity: "1", date: todayLocal(), note: "" });
  const [ending, setEnding] = useState<{ plan: DogPlan; status: "finished" | "cancelled" } | null>(null);

  const current = plans.filter((p) => isCurrent(planState(p)));
  const past = plans.filter((p) => !isCurrent(planState(p)));

  async function saveUsage() {
    if (!usagePlan) return;
    const quantity = parseInt(usage.quantity);
    if (!(quantity > 0)) return toast.error("La cantidad debe ser al menos 1");
    try {
      const left = await registerUsage.mutateAsync({ id: usagePlan.id, quantity, usedOn: usage.date, note: usage.note });
      toast.success(`Uso registrado · quedan ${left} ${usagePlan.unit_label ?? ""}`.trim());
      setUsagePlan(null);
    } catch (e) {
      toast.error("No se pudo registrar el uso", { description: e instanceof Error ? e.message : undefined });
    }
  }

  async function confirmEnd() {
    if (!ending) return;
    try {
      await end.mutateAsync({ id: ending.plan.id, status: ending.status });
      toast.success(ending.status === "finished" ? "Plan finalizado" : "Plan cancelado");
    } catch (e) {
      toast.error("No se pudo actualizar el plan", { description: e instanceof Error ? e.message : undefined });
    }
    setEnding(null);
  }

  if (isLoading) return <Skeleton className="h-32" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Plan</h2>
          <p className="text-sm text-muted-foreground">El plan contratado para {dogName}: vigencia, qué incluye y condiciones.</p>
        </div>
        {canManage && (
          <Button onClick={() => { setRenewFrom(null); setAssignOpen(true); }} className="gap-2 print:hidden">
            <Plus className="h-4 w-4" /> Asignar plan
          </Button>
        )}
      </div>

      {current.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-10 text-center text-muted-foreground">
            <ClipboardList className="mb-3 h-10 w-10 opacity-50" aria-hidden />
            <p>{dogName} no tiene un plan vigente.</p>
          </CardContent>
        </Card>
      ) : (
        current.map((plan) => {
          const state = planState(plan);
          return (
            <Card key={plan.id}>
              <CardContent className="space-y-3 p-4">
                <PlanCard plan={plan} />
                {plan.notes && <p className="rounded bg-muted/60 p-2 text-xs text-muted-foreground">{plan.notes}</p>}
                {canManage && (
                  <div className="flex flex-wrap gap-2 border-t pt-3 print:hidden">
                    {plan.billing === "quantity" && remainingUnits(plan)! > 0 && state !== "upcoming" && (
                      <Button size="sm" onClick={() => { setUsage({ quantity: "1", date: todayLocal(), note: "" }); setUsagePlan(plan); }} className="gap-1.5">
                        <CheckCheck className="h-4 w-4" /> Registrar uso
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => { setRenewFrom(plan); setAssignOpen(true); }} className="gap-1.5">
                      <RefreshCw className="h-4 w-4" /> Renovar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEnding({ plan, status: "finished" })}>Finalizar</Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive gap-1.5" onClick={() => setEnding({ plan, status: "cancelled" })}>
                      <XCircle className="h-4 w-4" /> Cancelar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Planes anteriores</h3>
          <ul className="space-y-2">
            {past.map((plan) => (
              <li key={plan.id} className="rounded-lg border p-3">
                <PlanCard plan={plan} compact />
                <p className="mt-1 text-xs text-muted-foreground">
                  {format(parseDateOnly(plan.start_date), "d MMM yyyy", { locale: es })}
                  {plan.end_date ? ` → ${format(parseDateOnly(plan.end_date), "d MMM yyyy", { locale: es })}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AssignPlanDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        dogs={[{ id: dogId, name: dogName }]}
        defaultDogId={dogId}
        renewFrom={renewFrom}
      />

      <Dialog open={!!usagePlan} onOpenChange={(o) => !o && setUsagePlan(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar uso</DialogTitle>
            <DialogDescription>
              {usagePlan && `${usagePlan.service_label} · quedan ${remainingUnits(usagePlan)} ${usagePlan.unit_label ?? ""}`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="usage-qty">Cantidad</Label>
                <Input id="usage-qty" type="number" min={1} value={usage.quantity} onChange={(e) => setUsage((u) => ({ ...u, quantity: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="usage-date">Fecha</Label>
                <Input id="usage-date" type="date" max={todayLocal()} value={usage.date} onChange={(e) => setUsage((u) => ({ ...u, date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usage-note">Nota (opcional)</Label>
              <Input id="usage-note" value={usage.note} onChange={(e) => setUsage((u) => ({ ...u, note: e.target.value }))} placeholder="Ej. Clase grupal de obediencia" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUsagePlan(null)}>Cancelar</Button>
            <Button onClick={saveUsage} disabled={registerUsage.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!ending} onOpenChange={(o) => !o && setEnding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ending?.status === "finished" ? "¿Finalizar el plan?" : "¿Cancelar el plan?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {ending?.status === "finished"
                ? "El plan deja de estar vigente desde hoy y pasa al historial."
                : "Úsalo si el plan se anuló o se registró por error. Queda en el historial como cancelado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEnd}>{ending?.status === "finished" ? "Finalizar" : "Cancelar plan"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
