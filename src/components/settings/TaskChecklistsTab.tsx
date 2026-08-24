import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, Save, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface ChecklistItem {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  isNew?: boolean;
}

function toSlug(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function TaskChecklistsTab() {
  const { organization, isAdmin } = useOrganization();
  const orgId = organization?.id;

  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    const { data, error } = await supabase
      .from("welfare_check_items")
      .select("id, key, label, sort_order")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("sort_order");
    if (error) {
      toast.error("No se pudieron cargar los ítems de la ronda de bienestar");
      return;
    }
    setItems(data ?? []);
    setDeletedIds([]);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const addItem = () => {
    const label = newLabel.trim();
    if (!label || !items) return;
    const key = toSlug(label);
    if (items.some((it) => it.key === key)) {
      toast.error("Ya existe un ítem con ese nombre");
      return;
    }
    setItems([
      ...items,
      { id: crypto.randomUUID(), key, label, sort_order: items.length + 1, isNew: true },
    ]);
    setNewLabel("");
  };

  const removeItem = (id: string) => {
    if (!items) return;
    setItems(items.filter((it) => it.id !== id));
    if (!items.find((it) => it.id === id)?.isNew) {
      setDeletedIds((prev) => [...prev, id]);
    }
  };

  const renameItem = (id: string, label: string) => {
    setItems((prev) => prev?.map((it) => (it.id === id ? { ...it, label } : it)) ?? null);
  };

  const handleSave = async () => {
    if (!items || !orgId) return;
    setSaving(true);
    try {
      if (deletedIds.length) {
        const { error } = await supabase.from("welfare_check_items").delete().in("id", deletedIds);
        if (error) throw error;
      }
      const toInsert = items.filter((it) => it.isNew);
      if (toInsert.length) {
        const { error } = await supabase.from("welfare_check_items").insert(
          toInsert.map((it) => ({
            organization_id: orgId,
            key: it.key,
            label: it.label,
            sort_order: it.sort_order,
          }))
        );
        if (error) throw error;
      }
      const toUpdate = items.filter((it) => !it.isNew);
      for (const it of toUpdate) {
        const { error } = await supabase
          .from("welfare_check_items")
          .update({ label: it.label })
          .eq("id", it.id);
        if (error) throw error;
      }
      toast.success("Ítems de la ronda de bienestar actualizados");
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudieron guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  if (!items) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Ronda de bienestar (chequeo AM/PM)
          </CardTitle>
          <CardDescription>
            Estos son los ítems que el trabajador puede marcar al revisar cada perro presente en
            las instalaciones durante la ronda de bienestar automática de la mañana y la noche.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-2 py-1">
                <Input
                  value={it.label}
                  onChange={(e) => renameItem(it.id, e.target.value)}
                  disabled={!isAdmin}
                  className="h-8 text-sm"
                />
                {isAdmin && (
                  <button
                    type="button"
                    className="text-xs text-destructive hover:underline shrink-0"
                    onClick={() => removeItem(it.id)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">No hay ítems configurados todavía.</p>
            )}
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Input
                placeholder="Nuevo ítem (ej. Vómito)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  }
                }}
              />
              <Button type="button" size="sm" variant="outline" disabled={!newLabel.trim()} onClick={addItem}>
                Agregar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar cambios
          </Button>
        </div>
      )}
      {!isAdmin && (
        <p className="text-sm text-muted-foreground text-right">
          Solo los administradores pueden modificar los ítems de la ronda de bienestar.
        </p>
      )}
    </div>
  );
}
