import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, HeartPulse, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";

interface WelfareEntry {
  entry_id: string;
  checked_at: string;
  round_title: string | null;
  present: boolean;
  flags: Record<string, boolean>;
  notes: string | null;
  checked_by: string | null;
}

/** Historial de rondas de bienestar de un perro (todas las del centro, no solo las propias). */
export function WelfareHistory({ dogId }: { dogId: string }) {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["dog-welfare-history", orgId, dogId],
    enabled: !!orgId,
    queryFn: async () => {
      const [history, items] = await Promise.all([
        supabase.rpc("get_dog_welfare_history" as never, { p_dog_id: dogId, p_limit: 30 } as never),
        supabase.from("welfare_check_items").select("key, label").eq("organization_id", orgId!),
      ]);
      if (history.error) throw history.error;
      const labels = new Map((items.data ?? []).map((i) => [i.key, i.label]));
      return { entries: (history.data ?? []) as unknown as WelfareEntry[], labels };
    },
  });

  if (isLoading) return <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}</div>;

  const entries = data?.entries ?? [];
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center text-sm text-muted-foreground">
        <HeartPulse className="mb-2 h-8 w-8 opacity-50" aria-hidden />
        Todavía no hay rondas de bienestar registradas para este perro.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((e) => {
        const issues = Object.entries(e.flags ?? {}).filter(([, v]) => v).map(([k]) => data!.labels.get(k) ?? k);
        const ok = e.present && issues.length === 0;
        return (
          <li key={e.entry_id} className="rounded-lg border p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {!e.present ? (
                  <XCircle className="h-4 w-4 text-destructive" aria-hidden />
                ) : ok ? (
                  <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
                )}
                <span className="font-medium">
                  {!e.present ? "No estaba presente" : ok ? "Sin novedad" : issues.join(" · ")}
                </span>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {format(new Date(e.checked_at), "d MMM · HH:mm", { locale: es })}
              </span>
            </div>
            {e.notes && <p className="mt-1 text-muted-foreground">{e.notes}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {e.round_title ?? "Ronda de bienestar"}{e.checked_by ? ` · ${e.checked_by}` : ""}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
