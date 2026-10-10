import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Plus, Edit, Trash2, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { usePermission } from "@/hooks/usePermission";
import { useDeleteOrgRole, useOrgRoles, useSaveOrgRole, type OrgRoleWithCount } from "@/hooks/queries/useOrgRoles";
import {
  ACCESS_TYPE_LABELS,
  ACCESS_TYPE_OPTIONS,
  PAGE_CATALOG,
  WORKER_DEFAULT_PAGES,
  PERMISSION_CATALOG,
  type AccessType,
  type OrgPage,
  type OrgPermission,
} from "@/lib/permissions";

const accessBadgeVariant: Record<AccessType, "default" | "secondary" | "outline"> = {
  admin: "default",
  panel: "secondary",
  worker: "outline",
};

export function RolesTab() {
  const canManage = usePermission("manage_staff");
  const { data: roles = [], isLoading } = useOrgRoles();
  const saveRole = useSaveOrgRole();
  const deleteRole = useDeleteOrgRole();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrgRoleWithCount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrgRoleWithCount | null>(null);
  const [name, setName] = useState("");
  const [accessType, setAccessType] = useState<AccessType>("panel");
  const [permissions, setPermissions] = useState<OrgPermission[]>([]);
  // null = ve todas las secciones (lo de siempre); una lista = solo esas.
  const [pages, setPages] = useState<OrgPage[] | null>(null);

  const openNew = () => {
    setEditing(null);
    setName("");
    setAccessType("panel");
    setPermissions(["schedule", "record_weight"]);
    setPages(null);
    setModalOpen(true);
  };

  const openEdit = (r: OrgRoleWithCount) => {
    setEditing(r);
    setName(r.name);
    setAccessType(r.access_type);
    setPermissions(r.permissions);
    setPages(r.pages ?? null);
    setModalOpen(true);
  };

  const togglePermission = (perm: OrgPermission, checked: boolean) => {
    setPermissions((prev) => (checked ? [...prev, perm] : prev.filter((p) => p !== perm)));
  };

  const togglePage = (page: OrgPage, checked: boolean) => {
    setPages((prev) => {
      const base = prev ?? PAGE_CATALOG.map((p) => p.key);
      return checked ? [...base, page] : base.filter((p) => p !== page);
    });
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 40) {
      toast.error("El nombre debe tener entre 2 y 40 caracteres");
      return;
    }
    // Administrador ve todo. Oficina con todas marcadas vuelve a "todas" (null);
    // Personal operativo siempre guarda su lista (sin lista = las de Mi día).
    const pagesToSave =
      accessType === "admin" ? null
      : accessType === "worker" ? (pages ?? WORKER_DEFAULT_PAGES)
      : !pages || pages.length === PAGE_CATALOG.length ? null : pages;
    if (pagesToSave && pagesToSave.length === 0) {
      toast.error("Marca al menos una sección del menú");
      return;
    }
    saveRole.mutate(
      { id: editing?.id, input: { name: trimmed, access_type: accessType, permissions, pages: pagesToSave } },
      {
        onSuccess: () => {
          toast.success(editing ? "Rol actualizado" : "Rol creado");
          setModalOpen(false);
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteRole.mutate(deleteTarget.id, {
      onSuccess: () => toast.success("Rol eliminado"),
      onSettled: () => setDeleteTarget(null),
    });
  };

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Solo un administrador puede gestionar los roles.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  // Tipo admin tiene todo; los roles de sistema no cambian de tipo.
  const isAdminType = accessType === "admin";
  const lockAccessType = !!editing?.is_system;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Roles y permisos</CardTitle>
              <CardDescription>
                Define los cargos de tu equipo con sus propios nombres y lo que cada uno puede hacer.
              </CardDescription>
            </div>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nuevo rol</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Rol</TableHead>
                <TableHead>Acceso</TableHead>
                <TableHead>Permisos</TableHead>
                <TableHead className="text-center">Personas</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {r.name}
                      {r.is_system && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Rol predeterminado" />}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={accessBadgeVariant[r.access_type]}>{ACCESS_TYPE_LABELS[r.access_type]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.access_type === "admin" ? "Todos" : `${r.permissions.length} de ${PERMISSION_CATALOG.length}`}
                    {r.access_type === "panel" && r.pages && (
                      <span className="block text-xs">{r.pages.length} de {PAGE_CATALOG.length} secciones</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{r.member_count}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} aria-label={`Editar rol ${r.name}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!r.is_system && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(r)}
                          aria-label={`Eliminar rol ${r.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-4 text-xs text-muted-foreground">
            Los roles con candado vienen por defecto: puedes renombrarlos y ajustar sus permisos, pero no eliminarlos.
            Gestionar personal, roles y configuración es exclusivo del acceso Administrador.
          </p>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar rol" : "Nuevo rol"}</DialogTitle>
            <DialogDescription>
              {editing && editing.member_count > 0
                ? `Los cambios aplican de inmediato a ${editing.member_count} persona${editing.member_count !== 1 ? "s" : ""}.`
                : "Ponle el nombre que usan en tu empresa y marca lo que puede hacer."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="role-name">Nombre del rol</Label>
              <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Coordinador, Paseador, Auxiliar" maxLength={40} />
            </div>

            <div className="space-y-2">
              <Label>Tipo de acceso</Label>
              <RadioGroup
                value={accessType}
                onValueChange={(v) => {
                  const next = v as AccessType;
                  setAccessType(next);
                  // Al pasar a Personal operativo sin lista, propone las secciones de Mi día.
                  if (next === "worker" && !pages) setPages(WORKER_DEFAULT_PAGES);
                }}
                disabled={lockAccessType}
                className="space-y-2"
              >
                {ACCESS_TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    htmlFor={`access-${opt.value}`}
                    className="flex items-start gap-3 rounded-md border p-3 cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                  >
                    <RadioGroupItem id={`access-${opt.value}`} value={opt.value} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium">{opt.label}</span>
                      <span className="block text-xs text-muted-foreground">{opt.description}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
              {lockAccessType && (
                <p className="text-xs text-muted-foreground">El tipo de acceso de un rol predeterminado no se puede cambiar.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Permisos</Label>
              {isAdminType ? (
                <p className="text-sm text-muted-foreground">El acceso Administrador incluye todos los permisos.</p>
              ) : (
                <div className="space-y-3">
                  {PERMISSION_CATALOG.map((p) => (
                    <label key={p.key} htmlFor={`perm-${p.key}`} className="flex items-start gap-3 cursor-pointer">
                      <Checkbox
                        id={`perm-${p.key}`}
                        checked={permissions.includes(p.key)}
                        onCheckedChange={(c) => togglePermission(p.key, c === true)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-sm font-medium">{p.label}</span>
                        <span className="block text-xs text-muted-foreground">{p.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {accessType !== "admin" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Secciones del menú</Label>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setPages(null)} disabled={!pages}>
                    Marcar todas
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Qué ve este rol en el menú. Lo que no marques no aparece y su enlace lleva a la primera sección permitida.
                </p>
                {[...new Set(PAGE_CATALOG.map((p) => p.group))].map((group) => (
                  <fieldset key={group} className="space-y-1.5">
                    <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</legend>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {PAGE_CATALOG.filter((p) => p.group === group).map((p) => (
                        <label key={p.key} htmlFor={`page-${p.key}`} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            id={`page-${p.key}`}
                            checked={!pages || pages.includes(p.key)}
                            onCheckedChange={(c) => togglePage(p.key, c === true)}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveRole.isPending}>
              {saveRole.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Guardar" : "Crear rol"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el rol "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.member_count > 0
                ? `Hay ${deleteTarget.member_count} persona${deleteTarget.member_count !== 1 ? "s" : ""} con este rol. Asígnales otro rol en Personal antes de eliminarlo.`
                : "Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!!deleteTarget && deleteTarget.member_count > 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
