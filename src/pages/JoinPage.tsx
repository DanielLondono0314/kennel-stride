import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dog, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "accepting">("loading");
  const [orgName, setOrgName] = useState("");
  const [role, setRole] = useState("");

  const ROLE_LABELS: Record<string, string> = {
    admin: "Administrador",
    manager: "Gerente",
    front_desk: "Recepción",
    trainer: "Entrenador",
  };

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }

    // Use SECURITY DEFINER function — prevents enumeration of all invitation tokens
    supabase
      .rpc("get_invitation_by_token", { p_token: token })
      .then(({ data }) => {
        if (!data) {
          setStatus("invalid");
          return;
        }
        const invite = data as { org_name: string; role: string };
        setOrgName(invite.org_name ?? "tu equipo");
        setRole(invite.role);

        // If already logged in, accept automatically
        if (user) {
          acceptInvitation();
        } else {
          setStatus("valid");
        }
      });
  }, [token, user?.id]);

  const acceptInvitation = async () => {
    if (!token) return;
    setStatus("accepting");
    const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
    if (error) {
      toast.error("Error al aceptar invitación", { description: error.message });
      setStatus("invalid");
    } else {
      toast.success(`Bienvenido a ${orgName}!`);
      navigate(`/${(data as { slug: string }).slug}/dashboard`, { replace: true });
    }
  };

  if (!token || status === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
          </div>
          <h2 className="text-xl font-bold">Enlace inválido o expirado</h2>
          <p className="text-muted-foreground text-sm">
            Esta invitación ya fue usada, expiró, o el enlace no es válido.
          </p>
          <Button asChild variant="outline">
            <Link to="/login">Ir al inicio de sesión</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === "loading" || status === "accepting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">
            {status === "accepting" ? "Uniéndote al equipo..." : "Verificando invitación..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-primary">
            <Dog className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <span className="font-bold text-xl">KennelOps</span>
        </div>

        <div className="border rounded-xl p-6 bg-card space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Invitación válida</p>
              <p className="text-sm text-muted-foreground">
                Te invitaron a unirte a <span className="font-medium text-foreground">{orgName}</span> como{" "}
                <span className="font-medium text-foreground">{ROLE_LABELS[role] ?? role}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="outline" asChild>
              <Link to={`/login?invite=${token}`}>Ya tengo cuenta</Link>
            </Button>
            <Button asChild>
              <Link to={`/register?invite=${token}`}>Crear cuenta</Link>
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Al unirte aceptas los términos de uso de KennelOps.
        </p>
      </div>
    </div>
  );
}
