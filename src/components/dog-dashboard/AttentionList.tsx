import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { DashboardDog } from "@/hooks/queries/useDogDashboard";
import { attentionReasons, type AttentionReason } from "./model";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const SEVERITY_DOT: Record<AttentionReason["severity"], string> = {
  0: "bg-destructive",
  1: "bg-warning",
  2: "bg-info",
};

interface Props {
  dogs: DashboardDog[];
  onOpen: (dog: DashboardDog) => void;
  onShowAll: () => void;
  limit?: number;
}

/** Perros ordenados por la gravedad de su motivo más urgente. */
export function AttentionList({ dogs, onOpen, onShowAll, limit = 6 }: Props) {
  const ranked = dogs
    .map((d) => ({ dog: d, reasons: attentionReasons(d).filter((r) => r.kind !== "plan_expiring") }))
    .filter((x) => x.reasons.length > 0 && x.reasons[0].severity < 2)
    .sort((a, b) => a.reasons[0].severity - b.reasons[0].severity || a.dog.name.localeCompare(b.dog.name, "es"));

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Requieren atención</CardTitle>
        <CardDescription>Cambios de peso fuera de rango y vacunas vencidas</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 px-2 pb-2">
        {ranked.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
            <ShieldCheck className="h-8 w-8 text-success" aria-hidden />
            <p className="text-sm font-medium text-foreground">Todo en orden</p>
            <p className="text-xs text-muted-foreground">Ningún perro activo tiene alertas de salud.</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {ranked.slice(0, limit).map(({ dog, reasons }) => (
              <li key={dog.id}>
                <button
                  type="button"
                  onClick={() => onOpen(dog)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={dog.photoUrl ?? undefined} alt="" />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{dog.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{dog.name}</p>
                    <ul className="space-y-0.5">
                      {reasons.slice(0, 2).map((r) => (
                        <li key={r.kind} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", SEVERITY_DOT[r.severity])} aria-hidden />
                          <span className="truncate">{r.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {ranked.length > limit && (
        <div className="border-t px-4 py-2">
          <Button variant="ghost" size="sm" className="w-full" onClick={onShowAll}>
            Ver los {ranked.length} perros
          </Button>
        </div>
      )}
    </Card>
  );
}
