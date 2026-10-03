import { BellRing, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlanActions, type OrgPlan } from "@/hooks/queries/useDogPlans";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";
import { whatsappHref } from "@/lib/contact";
import { REMINDER_STATE_LABELS, planProgressText, planReminderMessage, reminderDue } from "@/lib/dogPlans";

/**
 * Dueños a los que hay que avisarles que su plan vence, venció o se agotó.
 * Un toque abre WhatsApp con el mensaje listo y deja el aviso registrado,
 * para no avisar dos veces por lo mismo.
 */
export function PlanRemindersCard({ plans, canManage }: { plans: OrgPlan[]; canManage: boolean }) {
  const base = useOrgBasePath();
  const { markReminded } = usePlanActions();
  const due = plans
    .map((plan) => ({ plan, state: reminderDue(plan) }))
    .filter((x): x is { plan: OrgPlan; state: NonNullable<typeof x.state> } => x.state !== null)
    .sort((a, b) => (a.plan.end_date ?? "9999").localeCompare(b.plan.end_date ?? "9999"));

  if (due.length === 0) return null;

  const mark = (id: string, state: NonNullable<ReturnType<typeof reminderDue>>, silent = false) =>
    markReminded.mutate({ id, state }, {
      onSuccess: () => { if (!silent) toast.success("Recordatorio registrado"); },
      onError: (e) => toast.error("No se pudo registrar el recordatorio", { description: e instanceof Error ? e.message : undefined }),
    });

  return (
    <Card className="border-warning/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4 text-warning" aria-hidden /> Recordatorios para enviar ({due.length})
        </CardTitle>
        <CardDescription>
          Planes por vencer, vencidos o agotados cuyo dueño aún no sabe. Al enviar queda registrado y no vuelve a aparecer por lo mismo.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2">
        <ul className="divide-y">
          {due.map(({ plan, state }) => {
            const owner = plan.customers;
            const dogName = plan.dogs?.name ?? "su perro";
            const wa = whatsappHref(owner?.phone);
            const message = planReminderMessage(plan, dogName, owner?.first_name);
            return (
              <li key={plan.id} className="flex flex-col gap-2 px-2 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-1 text-sm">
                    <Link to={`${base}/dogs/${plan.dog_id}?tab=plan`} className="font-medium hover:underline">{dogName}</Link>
                    <span className="text-muted-foreground">· {owner ? `${owner.first_name} ${owner.last_name}` : "Sin dueño"}</span>
                    <Badge variant="outline" className="ml-1 text-[10px]">{REMINDER_STATE_LABELS[state]}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{plan.service_label} · {planProgressText(plan)}</p>
                  {plan.reminded_at && (
                    <p className="text-xs text-muted-foreground">Ya se le avisó antes por otra situación.</p>
                  )}
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-2">
                    {wa ? (
                      <Button size="sm" asChild className="gap-1.5" onClick={() => mark(plan.id, state, true)}>
                        <a href={`${wa}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="h-4 w-4" /> Enviar WhatsApp
                        </a>
                      </Button>
                    ) : (
                      <span className="self-center text-xs text-muted-foreground">Sin teléfono</span>
                    )}
                    <Button size="sm" variant="ghost" className="gap-1.5" disabled={markReminded.isPending} onClick={() => mark(plan.id, state)}>
                      <Check className="h-4 w-4" /> Ya avisé
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
