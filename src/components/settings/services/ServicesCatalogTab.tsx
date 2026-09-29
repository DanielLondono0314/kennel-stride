import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarRange, Hash, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CATEGORY_CONFIG } from "@/lib/reportCardServices";
import {
  BILLING_LABELS, CONSUMPTION_LABELS, billingSummary, categoryForService, priceSummary, serializeService,
  type BillingMode, type CatalogService,
} from "@/lib/serviceCatalog";
import { ServiceEditorDialog } from "./ServiceEditorDialog";

const BILLING_ICON: Record<BillingMode, typeof Repeat> = { duration: CalendarRange, quantity: Hash, per_use: Repeat };

/**
 * Catálogo de servicios del centro: cada uno se configura por separado
 * (modalidad por duración / cantidad / uso, precio, qué incluye y
 * condiciones). Los planes de los perros se crearán a partir de aquí.
 */
export function ServicesCatalogTab() {
  const { organization, isAdmin, refetch } = useOrganization();
  const { catalog } = useServiceTypes();
  const [editing, setEditing] = useState<CatalogService | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CatalogService | null>(null);
  const [saving, setSaving] = useState(false);

  const knownIncludes = useMemo(() => [...new Set(catalog.flatMap((s) => s.includes))], [catalog]);

  async function persist(next: CatalogService[], ok: string) {
    if (!organization) return false;
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({ service_types: next.map(serializeService) as never, updated_at: new Date().toISOString() })
      .eq("id", organization.id);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar el catálogo", { description: "Revisa tu conexión e inténtalo de nuevo." });
      return false;
    }
    toast.success(ok);
    refetch();
    return true;
  }

  async function handleSave(service: CatalogService) {
    const exists = catalog.some((s) => s.value === service.value);
    const next = exists ? catalog.map((s) => (s.value === service.value ? service : s)) : [...catalog, service];
    if (await persist(next, exists ? "Servicio actualizado" : "Servicio creado")) setEditorOpen(false);
  }

  async function handleDelete() {
    if (!toDelete) return;
    if (catalog.length <= 1) {
      toast.error("El centro debe tener al menos un servicio");
      setToDelete(null);
      return;
    }
    await persist(catalog.filter((s) => s.value !== toDelete.value), "Servicio eliminado");
    setToDelete(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Servicios del centro</h2>
          <p className="text-sm text-muted-foreground">
            Configura cada servicio a tu medida: si se vende por duración, por cantidad o por uso, qué incluye y sus condiciones.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setEditorOpen(true); }} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Nuevo servicio
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {catalog.map((s) => {
          const cat = CATEGORY_CONFIG[categoryForService(s)];
          const Icon = BILLING_ICON[s.billing];
          const price = priceSummary(s);
          return (
            <Card key={s.value} className={s.active ? undefined : "opacity-60"}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-tight">
                      <span aria-hidden>{cat.icon}</span> {s.label}
                    </h3>
                    <p className="text-xs text-muted-foreground">{cat.label}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!s.active && <Badge variant="secondary" className="text-xs">Inactivo</Badge>}
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar ${s.label}`} onClick={() => { setEditing(s); setEditorOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Eliminar ${s.label}`} onClick={() => setToDelete(s)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-medium">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {s.billing === "per_use" ? BILLING_LABELS.per_use : `${BILLING_LABELS[s.billing]} · ${billingSummary(s)}`}
                  </span>
                  {price && <span className="font-semibold">{price}</span>}
                  {s.billing === "quantity" && s.quantity && (
                    <span className="text-xs text-muted-foreground">Se descuenta: {CONSUMPTION_LABELS[s.quantity.consumption].toLowerCase()}</span>
                  )}
                </div>

                {s.includes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {s.includes.map((i) => (
                      <span key={i} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{i}</span>
                    ))}
                  </div>
                )}

                {s.conditions && <p className="line-clamp-2 text-xs text-muted-foreground">{s.conditions}</p>}

                {isAdmin && s.billing === "per_use" && s.includes.length === 0 && !s.conditions && s.price == null && (
                  <button type="button" onClick={() => { setEditing(s); setEditorOpen(true); }} className="text-xs font-medium text-primary underline underline-offset-2">
                    Configurar modalidad, precio e inclusiones
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ServiceEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        service={editing}
        takenValues={catalog.map((s) => s.value)}
        knownIncludes={knownIncludes}
        saving={saving}
        onSave={handleSave}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{toDelete?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Las reservas que ya usan este servicio lo conservan, pero no se podrá elegir de nuevo. Si solo quieres dejar de ofrecerlo por un tiempo, mejor desactívalo desde Editar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
