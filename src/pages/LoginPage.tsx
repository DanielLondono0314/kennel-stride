import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dog, Loader2 } from "lucide-react";
import { toast } from "sonner";

async function getFirstOrgSlug(userId: string): Promise<string | null> {
  const { data } = await (supabase as any)
    .from("organization_members")
    .select("organizations(slug)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return (data?.organizations as any)?.slug ?? null;
}

async function acceptInviteAndNavigate(token: string, navigate: ReturnType<typeof useNavigate>) {
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) {
    toast.error("Error al aceptar la invitación: " + error.message);
    return null;
  }
  return (data as { slug: string; role: string }) ?? null;
}

export default function LoginPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invite = searchParams.get("invite");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Redirect already-logged-in users
  useEffect(() => {
    if (!session) return;
    (async () => {
      if (invite) {
        const result = await acceptInviteAndNavigate(invite, navigate);
        if (result) {
          navigate(`/${result.slug}/dashboard`, { replace: true });
          return;
        }
      }
      const slug = await getFirstOrgSlug(session.user.id);
      navigate(slug ? `/${slug}/dashboard` : "/onboarding", { replace: true });
    })();
  }, [session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    if (invite) {
      const result = await acceptInviteAndNavigate(invite, navigate);
      if (result) {
        navigate(`/${result.slug}/dashboard`, { replace: true });
        setLoading(false);
        return;
      }
    }
    const slug = await getFirstOrgSlug(data.user.id);
    navigate(slug ? `/${slug}/dashboard` : "/onboarding", { replace: true });
    setLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const redirectUri = invite
      ? `${window.location.origin}/login?invite=${invite}`
      : window.location.origin + "/login";
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: redirectUri,
    });
    if (result.error) {
      toast.error(result.error instanceof Error ? result.error.message : String(result.error));
      setGoogleLoading(false);
    }
    if (result.redirected) return;
    setGoogleLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-primary">
            <Dog className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <span className="font-bold text-sidebar-foreground text-xl">KennelOps</span>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-sidebar-foreground leading-tight">
            Gestiona tu centro<br />de adiestramiento<br />con facilidad
          </h1>
          <p className="text-sidebar-foreground/60 text-lg leading-relaxed">
            Control total de reservas, clientes, perros y facturación en un solo lugar.
          </p>
          <div className="flex flex-col gap-2 pt-4">
            {["Reservas y check-in en tiempo real", "Historial clínico y vacunas", "Facturación y paquetes", "Gestión de instalaciones"].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sidebar-foreground/70 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className="text-sidebar-foreground/30 text-sm">© 2025 KennelOps</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-primary">
              <Dog className="h-6 w-6 text-sidebar-primary-foreground" />
            </div>
            <span className="font-bold text-xl">KennelOps</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight">Bienvenido</h2>
            <p className="text-muted-foreground mt-1">Accede a tu cuenta para continuar</p>
          </div>

          <Button variant="outline" className="w-full gap-3 h-11" onClick={handleGoogle} disabled={googleLoading || loading}>
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continuar con Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">O continúa con email</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              <div className="text-right">
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading || googleLoading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Iniciar sesión
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Crear cuenta gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
