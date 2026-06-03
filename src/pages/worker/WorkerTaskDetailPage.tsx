import { useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Pill, Leaf, Loader2, ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWorkItem } from "@/hooks/queries/useWorkItem";
import { useMyStaffMember } from "@/hooks/useMyStaffMember";
import { useUpdateTask } from "@/hooks/queries/useTasks";
import { useUpdateReservationStatus } from "@/hooks/queries/useReservationStatus";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import { reservationBucket, STATUS_LABELS } from "@/lib/worker";
import { ReportRouter, type ReportTarget } from "@/components/worker/reports/ReportRouter";

export default function WorkerTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const kind: "task" | "reservation" = location.pathname.includes("/reservation/")
    ? "reservation"
    : "task";

  const { data: item, isLoading } = useWorkItem(kind, id);
  const { data: staff } = useMyStaffMember();
  const navigate = useOrgNavigate();
  const queryClient = useQueryClient();
  const updateTask = useUpdateTask();
  const updateReservation = useUpdateReservationStatus();
  const [reporting, setReporting] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!item) {
    return (
      <div className="space-y-4">
        <BackButton onClick={() => navigate("/worker")} />
        <p className="text-sm text-muted-foreground">No se encontró el elemento.</p>
      </div>
    );
  }

  const bucket = kind === "reservation" ? reservationBucket(item.status) : item.status;
  const isDone = bucket === "done";
  const isInProgress = bucket === "in_progress";

  async function advance() {
    if (!item) return;
    setAdvancing(true);
    try {
      if (kind === "task") {
        await updateTask.mutateAsync({ id: item.id, patch: { status: "in_progress" } });
      } else {
        await updateReservation.mutateAsync({ id: item.id, patch: { status: "in_progress" } });
      }
      queryClient.invalidateQueries({ queryKey: ["work-item", kind] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al iniciar");
    } finally {
      setAdvancing(false);
    }
  }

  function onReportDone() {
    setReporting(false);
    queryClient.invalidateQueries({ queryKey: ["work-item", kind] });
    queryClient.invalidateQueries({ queryKey: ["my-day"] });
    navigate("/worker");
  }

  const target: ReportTarget = {
    kind,
    id: item.id,
    dogId: item.dogId,
    dogName: item.dogName,
    serviceType: item.serviceType,
  };

  return (
    <div className="space-y-4">
      <BackButton onClick={() => navigate("/worker")} />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg">{item.dogName ?? item.title}</CardTitle>
            <Badge variant="secondary">{STATUS_LABELS[bucket as keyof typeof STATUS_LABELS] ?? item.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {item.title}
            {item.time
              ? ` · ${new Date(item.time).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`
              : ""}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {(item.flags.aggressive || item.flags.allergies || item.flags.medication) && (
            <div className="flex flex-wrap gap-2">
              {item.flags.aggressive && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> Agresivo
                </Badge>
              )}
              {item.flags.allergies && (
                <Badge variant="outline" className="gap-1 text-amber-600">
                  <Leaf className="h-3 w-3" /> Alergias
                </Badge>
              )}
              {item.flags.medication && (
                <Badge variant="outline" className="gap-1 text-blue-600">
                  <Pill className="h-3 w-3" /> Medicación
                </Badge>
              )}
            </div>
          )}
          {item.notes && <p className="text-sm">{item.notes}</p>}
        </CardContent>
      </Card>

      {isDone ? (
        <p className="text-sm text-muted-foreground">Este trabajo ya está completado.</p>
      ) : isInProgress ? (
        <Button className="w-full" size="lg" onClick={() => setReporting(true)}>
          Completar y reportar
        </Button>
      ) : (
        <Button className="w-full" size="lg" onClick={advance} disabled={advancing}>
          {advancing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Iniciar
        </Button>
      )}

      <Sheet open={reporting} onOpenChange={setReporting}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Reporte</SheetTitle>
          </SheetHeader>
          <div className="pt-4">
            {staff?.id && (
              <ReportRouter specialty={staff.specialty} target={target} staffId={staff.id} onDone={onReportDone} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2 gap-1" onClick={onClick}>
      <ArrowLeft className="h-4 w-4" /> Mi día
    </Button>
  );
}
