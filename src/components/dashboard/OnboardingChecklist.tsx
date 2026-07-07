import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, ChevronRight, X, Sparkles, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface OnboardingStatus {
  has_customers: boolean;
  has_zones: boolean;
  has_staff: boolean;
  has_schedule: boolean;
  has_reservations: boolean;
}

interface Step {
  key: keyof OnboardingStatus;
  label: string;
  description: string;
  path: string;
}

const STEPS: Step[] = [
  { key: "has_schedule",    label: "Configura el horario",       description: "Define el horario de apertura y cierre del centro.", path: "/settings" },
  { key: "has_zones",       label: "Configura las instalaciones", description: "Añade zonas y boxes donde hospedarás a los perros.", path: "/facility" },
  { key: "has_customers",   label: "Añade tu primer cliente",     description: "Registra a un cliente con su perro.", path: "/customers" },
  { key: "has_staff",       label: "Invita a tu equipo",          description: "Añade entrenadores o recepcionistas.", path: "/staff" },
  { key: "has_reservations",label: "Crea tu primera reserva",     description: "Programa una llegada desde el dashboard.", path: "/dashboard" },
];

const DISMISSED_KEY = "onboarding_dismissed_v1";

export function OnboardingChecklist() {
  const { organization } = useOrganization();
  const navigate = useOrgNavigate();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "true"
  );
  const [seeding, setSeeding] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["onboarding-status", organization?.id],
    enabled: !!organization?.id && !dismissed,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_onboarding_status", {
        p_org_id: organization!.id,
      });
      if (error) throw error;
      return data as unknown as OnboardingStatus;
    },
  });

  // ¿Hay datos de ejemplo sembrados? (cliente demo reconocible por su email)
  const { data: hasDemo } = useQuery({
    queryKey: ["demo-data-exists", organization?.id],
    enabled: !!organization?.id && !dismissed,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id")
        .eq("organization_id", organization!.id)
        .eq("email", "demo@kennelops.example")
        .maybeSingle();
      return !!data;
    },
  });

  const refreshAll = () => {
    // Los datos demo tocan clientes/perros/reservas/paquetes: refrescar todo.
    queryClient.invalidateQueries();
  };

  const handleSeedDemo = async () => {
    if (!organization) return;
    setSeeding(true);
    const { error } = await supabase.rpc("seed_demo_data", { p_org_id: organization.id });
    setSeeding(false);
    if (error) {
      toast.error("No se pudieron cargar los datos de ejemplo", { description: error.message });
      return;
    }
    toast.success("Datos de ejemplo cargados", {
      description: "Explora el cliente, los perros y las reservas demo. Bórralos cuando quieras.",
    });
    refreshAll();
  };

  const handleRemoveDemo = async () => {
    if (!organization) return;
    setSeeding(true);
    const { error } = await supabase.rpc("remove_demo_data", { p_org_id: organization.id });
    setSeeding(false);
    if (error) {
      toast.error("No se pudieron quitar los datos de ejemplo", { description: error.message });
      return;
    }
    toast.success("Datos de ejemplo eliminados");
    refreshAll();
  };

  if (dismissed || !status) return null;

  const completedCount = STEPS.filter((s) => status[s.key]).length;
  if (completedCount === STEPS.length) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              Primeros pasos
              <span className="text-sm font-normal text-muted-foreground">
                {completedCount}/{STEPS.length} completados
              </span>
            </CardTitle>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground shrink-0 ml-3"
            onClick={handleDismiss}
            aria-label="Descartar checklist de bienvenida"
            title="Ocultar checklist"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {STEPS.map((step) => {
            const done = status[step.key];
            return (
              <div
                key={step.key}
                className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                  done
                    ? "opacity-50"
                    : "hover:bg-muted/50 cursor-pointer"
                }`}
                onClick={() => !done && navigate(step.path)}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium leading-tight ${done ? "line-through text-muted-foreground" : ""}`}>
                    {step.label}
                  </p>
                  {!done && (
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  )}
                </div>
                {!done && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* PR-12: ver el producto vivo sin cargar datos reales */}
        <div className="mt-3 pt-3 border-t border-primary/10">
          {hasDemo ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground gap-2"
              onClick={handleRemoveDemo}
              disabled={seeding}
            >
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Quitar datos de ejemplo
            </Button>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">
                ¿Quieres ver el producto en acción antes de cargar tus datos?
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleSeedDemo}
                disabled={seeding}
              >
                {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Cargar datos de ejemplo
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
