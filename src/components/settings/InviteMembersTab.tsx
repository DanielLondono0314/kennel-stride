import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users2, Copy, Trash2, Loader2, Clock, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { invitationSchema } from "@/lib/schemas";
import { getFunctionErrorMessage } from "@/lib/functionError";
import { useOrgRoles } from "@/hooks/queries/useOrgRoles";

interface Invitation {
  id: string;
  email: string;
  role_id: string;
  org_roles: { name: string } | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export function InviteMembersTab() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState("");
  const { data: roles = [] } = useOrgRoles();
  const [pickedRoleId, setRoleId] = useState("");
  const roleId = pickedRoleId || roles.find((r) => r.system_key === "worker")?.id || "";
  const [resendingId, setResendingId] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    if (!organization) return;
    const { data } = await supabase
      .from("organization_invitations")
      .select("id, email, role_id, org_roles(name), token, expires_at, accepted_at, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false });
    if (data) setInvitations(data);
    setLoading(false);
  }, [organization]);

  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !user) return;
    const parsed = invitationSchema.safeParse({ email, role_id: roleId });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }

    setSending(true);
    const { data, error } = await supabase
      .from("organization_invitations")
      .insert({
        organization_id: organization.id,
        email: parsed.data.email.toLowerCase(),
        role_id: parsed.data.role_id,
        invited_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      toast.error("Error al crear invitación", { description: error.message });
      setSending(false);
      return;
    }

    setEmail("");
    fetchInvitations();
    const emailError = await sendInvitationEmail(data.id);
    if (emailError) {
      // El envío falló pero la invitación existe: dejamos el enlace listo para compartir a mano.
      copyLink(data.token, false);
      toast.warning("Invitación creada, pero no se pudo enviar el email", {
        description: `${emailError} El enlace se copió al portapapeles para que lo compartas.`,
      });
    } else {
      toast.success("Invitación enviada", { description: `Enviamos el enlace a ${data.email}.` });
    }
    setSending(false);
  };

  /** Envía el email de invitación. Devuelve el motivo del error, o null si se envió. */
  const sendInvitationEmail = async (invitationId: string): Promise<string | null> => {
    const { data, error } = await supabase.functions.invoke("send-invitation", {
      body: { invitationId },
    });
    if (error) return getFunctionErrorMessage(error, "Revisa tu conexión e inténtalo de nuevo.");
    if (!data?.success) return data?.error ?? "Revisa tu conexión e inténtalo de nuevo.";
    return null;
  };

  const handleResend = async (inv: Invitation) => {
    setResendingId(inv.id);
    const emailError = await sendInvitationEmail(inv.id);
    setResendingId(null);
    if (emailError) {
      toast.error("No se pudo reenviar la invitación", { description: emailError });
    } else {
      toast.success("Invitación reenviada", { description: `Enviamos el enlace a ${inv.email}.` });
    }
  };

  const copyLink = (token: string, notify = true) => {
    const link = `${window.location.origin}/join?token=${token}`;
    navigator.clipboard.writeText(link);
    if (notify) toast.success("Enlace copiado", { description: "Compártelo con tu colaborador." });
  };

  const handleDelete = async (id: string) => {
    if (!organization) return;
    const { error } = await supabase
      .from("organization_invitations")
      .delete()
      .eq("id", id)
      .eq("organization_id", organization.id);
    if (error) {
      toast.error("No se pudo eliminar la invitación", { description: "Inténtalo de nuevo." });
    } else {
      toast.success("Invitación eliminada");
      setInvitations((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const isExpired = (expires_at: string) => new Date(expires_at) < new Date();

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users2 className="h-5 w-5" />
            Invitar miembro al equipo
          </CardTitle>
          <CardDescription>
            Enviamos un enlace de invitación al correo de tu colaborador.
            Debe crear su cuenta con ese mismo correo. El enlace expira en 7 días.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="invite-email">Correo electrónico</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colaborador@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Rol</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={sending} className="w-full sm:w-auto">
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                Enviar invitación
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invitaciones enviadas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : invitations.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">
              No hay invitaciones pendientes
            </p>
          ) : (
            <div className="space-y-3">
              {invitations.map((inv) => {
                const accepted = !!inv.accepted_at;
                const expired = !accepted && isExpired(inv.expires_at);
                return (
                  <div key={inv.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">{inv.email}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">{inv.org_roles?.name ?? "—"}</Badge>
                        {accepted ? (
                          <span className="flex items-center gap-1 text-xs text-success">
                            <CheckCircle2 className="h-3 w-3" /> Aceptada
                          </span>
                        ) : expired ? (
                          <span className="flex items-center gap-1 text-xs text-destructive">
                            <Clock className="h-3 w-3" /> Expirada
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Expira {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true, locale: es })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!accepted && !expired && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleResend(inv)}
                            disabled={resendingId === inv.id}
                            aria-label="Reenviar invitación por email"
                          >
                            {resendingId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyLink(inv.token)} aria-label="Copiar enlace de invitación">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(inv.id)}
                        aria-label="Cancelar invitación"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
