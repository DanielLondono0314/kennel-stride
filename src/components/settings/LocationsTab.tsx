import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPinned, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useMyOrganizations, useSedeQuota } from "@/hooks/queries/useMyOrganizations";
import { locationLabel } from "@/lib/myOrganizations";
import { ORG_SLUG_PATTERN, toOrgSlug } from "@/lib/orgSlug";
import { LEGAL_DOCS } from "@/lib/legal";
import { OrgAvatar } from "@/components/navigation/OrgSwitcher";
import { LegalConsentCheckbox } from "@/components/legal/LegalConsentCheckbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Sedes del negocio (plan Premium). Cada sede es un centro con sus propios
 * clientes, catálogo, inventario y personal; comparte la suscripción de la
 * principal. Solo el dueño de la principal crea sedes (ver create_sede).
 */
export function LocationsTab() {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const { data: quota, isLoading } = useSedeQuota(organization?.id);
  const { data: orgs = [] } = useMyOrganizations();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading || !quota) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const locations = orgs.filter((o) => o.id === quota.principal_id || o.parentOrgId === quota.principal_id);

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPinned className="h-5 w-5" />
            Sedes
          </CardTitle>
          <CardDescription>
            Cada sede maneja sus propios clientes, servicios, inventario y personal. Todas comparten el plan
            Premium de la sede principal y cambias entre ellas desde el nombre del centro en el menú.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Centros en uso</span>
              <span className="font-medium">{quota.used} de {quota.max}</span>
            </div>
            <Progress value={(quota.used / quota.max) * 100} aria-label={`${quota.used} de ${quota.max} centros`} />
          </div>

          <ul className="divide-y rounded-lg border">
            {locations.map((o) => (
              <li key={o.id} className="flex items-center gap-3 p-3">
                <OrgAvatar org={o} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.name}</p>
                  <p className="truncate text-xs text-muted-foreground">tailsup.app/{o.slug}</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">{locationLabel(o, orgs) ?? "Sede principal"}</Badge>
                {o.id === organization?.id ? (
                  <span className="w-16 shrink-0 text-center text-xs text-muted-foreground">Actual</span>
                ) : (
                  <Button variant="ghost" size="sm" className="w-16 shrink-0" onClick={() => navigate(`/${o.slug}`)}>
                    Abrir
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {quota.is_owner ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {quota.can_create
                  ? "La nueva sede arranca vacía: configura su catálogo y su equipo desde ella."
                  : quota.reason}
              </p>
              <Button onClick={() => setDialogOpen(true)} disabled={!quota.can_create} className="shrink-0 gap-2">
                <Plus className="h-4 w-4" />
                Nueva sede
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Las sedes las crea el dueño de {quota.principal_name}.
            </p>
          )}
        </CardContent>
      </Card>

      {quota.is_owner && (
        <NewSedeDialog open={dialogOpen} onOpenChange={setDialogOpen} principalId={quota.principal_id} />
      )}
    </div>
  );
}

function NewSedeDialog({
  open,
  onOpenChange,
  principalId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  principalId: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugEdited ? slug : toOrgSlug(name);
  const slugValid = ORG_SLUG_PATTERN.test(effectiveSlug);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) { setError("Escribe el nombre de la sede"); return; }
    if (!slugValid) { setError("URL inválido: usa 3–40 caracteres, solo minúsculas, números y guiones"); return; }
    if (!accepted) { setError("Debes aceptar los documentos legales para crear la sede"); return; }

    setSaving(true);
    const { error: rpcError } = await supabase.rpc("create_sede", {
      p_parent_org_id: principalId,
      p_name: name,
      p_slug: effectiveSlug,
      p_dpa_version: LEGAL_DOCS.data_processing.version,
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my-organizations"] }),
      queryClient.invalidateQueries({ queryKey: ["sede-quota"] }),
    ]);
    toast.success(`Sede "${name.trim()}" creada`);
    onOpenChange(false);
    navigate(`/${effectiveSlug}/dashboard`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Nueva sede</DialogTitle>
            <DialogDescription>
              Tendrá su propia dirección, clientes, catálogo y personal. Tú quedas como administrador.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="sede-name">Nombre de la sede *</Label>
            <Input
              id="sede-name"
              placeholder="Ej: Huellitas Norte"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sede-slug">URL de acceso *</Label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-muted-foreground">tailsup.app/</span>
              <Input
                id="sede-slug"
                placeholder="huellitas-norte"
                value={effectiveSlug}
                onChange={(e) => { setSlugEdited(true); setSlug(toOrgSlug(e.target.value)); }}
              />
            </div>
          </div>

          <LegalConsentCheckbox id="sede-legal-consent" variant="organization" checked={accepted} onCheckedChange={setAccepted} />

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || !accepted} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear sede
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
