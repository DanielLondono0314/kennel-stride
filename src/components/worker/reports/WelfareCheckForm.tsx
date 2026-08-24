import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useCloseTarget } from "./useCloseTarget";
import type { ReportFormProps } from "./ReportRouter";

interface ChecklistItem {
  key: string;
  label: string;
}

interface EntryRow {
  id: string;
  dogId: string;
  dogName: string;
  present: boolean;
  flags: Record<string, boolean>;
  notes: string;
}

/**
 * Ronda de bienestar: una fila por CADA perro presente en las instalaciones al
 * momento de generarse la tarea (no un solo perro por tarea). Al guardar,
 * cualquier perro marcado ausente o con una novedad genera un aviso al admin.
 */
export function WelfareCheckForm({ target, staffId, onDone }: ReportFormProps) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const { closeTask } = useCloseTarget(target, staffId);

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [rows, setRows] = useState<EntryRow[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const [{ data: itemsData }, { data: entriesData, error }] = await Promise.all([
        supabase
          .from("welfare_check_items")
          .select("key, label")
          .eq("organization_id", orgId)
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("welfare_check_entries")
          .select("id, dog_id, present, flags, notes, dogs(name)")
          .eq("task_id", target.id),
      ]);
      if (error) {
        toast.error("No se pudo cargar la ronda de bienestar");
        return;
      }
      setItems(itemsData ?? []);
      setRows(
        (entriesData ?? []).map((e: any) => ({
          id: e.id,
          dogId: e.dog_id,
          dogName: e.dogs?.name ?? "Perro",
          present: e.present,
          flags: e.flags ?? {},
          notes: e.notes ?? "",
        }))
      );
    })();
  }, [orgId, target.id]);

  function updateRow(id: string, patch: Partial<EntryRow>) {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? null);
  }

  async function handleSubmit() {
    if (!rows || !orgId) return;
    setSubmitting(true);
    try {
      for (const row of rows) {
        const { error } = await supabase
          .from("welfare_check_entries")
          .update({ present: row.present, flags: row.flags, notes: row.notes || null })
          .eq("id", row.id);
        if (error) throw error;

        const activeFlags = Object.entries(row.flags).filter(([, v]) => v).map(([k]) => k);
        const hasNovelty = !row.present || activeFlags.length > 0;
        if (hasNovelty) {
          const critical = !row.present || activeFlags.some((k) => k === "fuga" || k === "mordida");
          const flagLabels = activeFlags
            .map((k) => items.find((it) => it.key === k)?.label ?? k)
            .join(", ");
          const parts = [
            !row.present ? "no está presente" : null,
            flagLabels ? `novedad: ${flagLabels}` : null,
            row.notes ? row.notes : null,
          ].filter(Boolean);
          await supabase.from("notices").insert({
            organization_id: orgId,
            title: "Novedad en ronda de bienestar",
            message: `${row.dogName}: ${parts.join(" · ")}`,
            severity: critical ? "critical" : "warning",
            entity_type: "dog",
            entity_id: row.dogId,
            auto_generated: true,
          });
        }
      }
      await closeTask({});
      toast.success("Ronda de bienestar guardada");
      onDone();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error guardando la ronda");
    } finally {
      setSubmitting(false);
    }
  }

  if (!rows) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No hay perros registrados en esta ronda.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {rows.map((row) => (
          <Card key={row.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{row.dogName}</span>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={row.present}
                    onCheckedChange={(c) => updateRow(row.id, { present: !!c })}
                  />
                  Presente
                </label>
              </div>

              {!row.present && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> Se avisará al panel admin.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {items.map((item) => {
                  const active = !!row.flags[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        updateRow(row.id, { flags: { ...row.flags, [item.key]: !active } })
                      }
                      className={
                        "rounded-full px-3 py-1 text-xs border transition-colors " +
                        (active
                          ? "bg-destructive text-destructive-foreground border-destructive"
                          : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted")
                      }
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <Input
                placeholder="Nota (opcional)"
                value={row.notes}
                onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                className="h-8 text-sm"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Guardar ronda
      </Button>
    </div>
  );
}
