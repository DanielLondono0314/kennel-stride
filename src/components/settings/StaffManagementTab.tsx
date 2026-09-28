import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Plus, Edit, Trash2, Loader2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";
import { telHref } from "@/lib/contact";
import { staffMemberSchema } from "@/lib/schemas";
import { type Specialty, SPECIALTY_LABELS } from "@/lib/worker";
import { useOrgRoles } from "@/hooks/queries/useOrgRoles";
import { useStaffList } from "@/hooks/queries/useStaffMembers";
import { useQueryClient } from "@tanstack/react-query";
import type { AccessType } from "@/lib/permissions";

type StaffMember = Tables<"staff_members">;

const accessBadgeVariant: Record<AccessType, "default" | "secondary" | "outline"> = {
  admin: "default",
  panel: "secondary",
  worker: "outline",
};

export function StaffManagementTab() {
  const basePath = useOrgBasePath();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);
  const { organization } = useOrganization();
  const { data: roles = [] } = useOrgRoles();
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const defaultRoleId = roles.find((r) => r.system_key === "worker")?.id ?? "";

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [specialty, setSpecialty] = useState<Specialty | "">("");
  const [isActive, setIsActive] = useState(true);

  const queryClient = useQueryClient();
  const { data: staffData, isLoading: staffLoading, isError: staffError } = useStaffList();
  const staff = (staffData ?? []) as StaffMember[];
  const loading = staffLoading;
  // Recarga la lista compartida (tabla, estadísticas y selects de personal).
  const fetchStaff = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["staff-members", organization?.id] });
  }, [queryClient, organization?.id]);

  useEffect(() => {
    if (staffError) toast.error("No se pudo cargar el personal", { description: "Vuelve a cargar la página." });
  }, [staffError]);


  const resetForm = () => {
    setFirstName(""); setLastName(""); setEmail(""); setPhone(""); setRoleId(defaultRoleId); setSpecialty(""); setIsActive(true);
    setEditingStaff(null);
  };

  const openNew = () => { resetForm(); setModalOpen(true); };

  const openEdit = (s: StaffMember) => {
    setEditingStaff(s);
    setFirstName(s.first_name);
    setLastName(s.last_name);
    setEmail(s.email);
    setPhone(s.phone || "");
    setRoleId(s.role_id ?? "");
    setSpecialty((s.specialty as Specialty | null) ?? "");
    setIsActive(s.is_active);
    setModalOpen(true);
  };

  const openDelete = (s: StaffMember) => { setDeleteTarget(s); setDeleteDialogOpen(true); };

  const isWorkerRole = roleById.get(roleId)?.access_type === "worker";

  const handleSave = async () => {
    if (!organization) {
      toast.error("Organización no cargada, intenta de nuevo"); return;
    }
    const parsed = staffMemberSchema.safeParse({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      role_id: roleId,
      specialty: isWorkerRole ? (specialty || null) : null,
      is_active: isActive,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    const payload = parsed.data;
    setSaving(true);
    if (editingStaff) {
      const { error } = await supabase
        .from("staff_members")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editingStaff.id)
        .eq("organization_id", organization.id);
      if (error) { toast.error("No se pudo actualizar", { description: error.message }); setSaving(false); return; }
      else { toast.success("Empleado actualizado"); }
    } else {
      const { error } = await supabase
        .from("staff_members")
        .insert({ ...payload, organization_id: organization.id });
      if (error) { toast.error("No se pudo crear", { description: "Revisa los datos e inténtalo de nuevo." }); setSaving(false); return; }
      else { toast.success("Empleado creado"); }
    }
    setSaving(false);
    setModalOpen(false);
    resetForm();
    fetchStaff();
  };

  const handleDelete = async () => {
    if (!deleteTarget || !organization) return;
    const { error } = await supabase
      .from("staff_members")
      .delete()
      .eq("id", deleteTarget.id)
      .eq("organization_id", organization.id);
    if (error) { toast.error("No se pudo eliminar", { description: "Inténtalo de nuevo." }); }
    else { toast.success("Empleado eliminado"); }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    fetchStaff();
  };

  const toggleActive = async (s: StaffMember) => {
    if (!organization) return;
    const { error } = await supabase
      .from("staff_members")
      .update({ is_active: !s.is_active, updated_at: new Date().toISOString() })
      .eq("id", s.id)
      .eq("organization_id", organization.id);
    if (error) { toast.error("No se pudo completar la acción", { description: "Inténtalo de nuevo." }); }
    else { toast.success(s.is_active ? "Empleado desactivado" : "Empleado activado"); fetchStaff(); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Personal</CardTitle>
              <CardDescription>{staff.length} empleado{staff.length !== 1 ? "s" : ""} registrado{staff.length !== 1 ? "s" : ""}</CardDescription>
            </div>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nuevo empleado</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Empleado</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s) => {
                const initials = `${s.first_name[0] || ""}${s.last_name[0] || ""}`.toUpperCase();
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">{initials}</AvatarFallback>
                        </Avatar>
                        <Link
                          to={`${basePath}/tasks?assignee=${s.id}`}
                          className="font-medium hover:underline"
                          title="Ver sus tareas"
                        >
                          {s.first_name} {s.last_name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.email ? <a href={`mailto:${s.email}`} className="hover:underline">{s.email}</a> : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.phone ? <a href={telHref(s.phone) ?? undefined} className="hover:underline">{s.phone}</a> : "—"}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const r = s.role_id ? roleById.get(s.role_id) : undefined;
                        return r ? <Badge variant={accessBadgeVariant[r.access_type]}>{r.name}</Badge> : <Badge variant="outline">—</Badge>;
                      })()}
                    </TableCell>
                    <TableCell>
                      <button onClick={() => toggleActive(s)} className="cursor-pointer">
                        {s.is_active ? (
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            <UserCheck className="h-3 w-3 mr-1" />Activo
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <UserX className="h-3 w-3 mr-1" />Inactivo
                          </Badge>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} aria-label="Editar miembro"><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDelete(s)} aria-label="Eliminar miembro"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No hay empleados registrados</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Staff modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { resetForm(); } setModalOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStaff ? "Editar Empleado" : "Nuevo Empleado"}</DialogTitle>
            <DialogDescription>
              {editingStaff ? "Actualiza los datos del empleado" : "Añade un nuevo miembro del equipo"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nombre" />
              </div>
              <div className="space-y-2">
                <Label>Apellido *</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellido" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+57 300 123 4567" />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingStaff?.profile_id && (
                <p className="text-xs text-muted-foreground">Cambiar el rol cambia también el acceso de esta persona a la app.</p>
              )}
            </div>
            {isWorkerRole && (
              <div className="space-y-2">
                <Label>Especialidad</Label>
                <Select value={specialty} onValueChange={(v) => setSpecialty(v as Specialty)}>
                  <SelectTrigger><SelectValue placeholder="Especialidad" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SPECIALTY_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Activo</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingStaff ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && `¿Estás seguro de eliminar a ${deleteTarget.first_name} ${deleteTarget.last_name}? Esta acción no se puede deshacer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
