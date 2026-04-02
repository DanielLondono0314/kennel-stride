import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dog, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");

  if (session) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) toast.error(error.message);
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword !== signupConfirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Cuenta creada", {
        description: "Revisa tu correo para confirmar tu cuenta.",
      });
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/",
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
      {/* Left panel — branding */}
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
            {["Reservas y check-in en tiempo real", "Historial clínico y vacunas", "Facturación y paquetes", "Gestión de instalaciones"].map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-sidebar-foreground/70 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                {feature}
              </div>
            ))}
          </div>
        </div>

        <p className="text-sidebar-foreground/30 text-sm">
          © 2025 KennelOps · Centro de Adiestramiento
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-primary">
              <Dog className="h-6 w-6 text-sidebar-primary-foreground" />
            </div>
            <span className="font-bold text-xl">KennelOps</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight">Bienvenido</h2>
            <p className="text-muted-foreground mt-1">
              Accede a tu cuenta para continuar
            </p>
          </div>

          {/* Google OAuth */}
          <Button
            variant="outline"
            className="w-full gap-3 h-11"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
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
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                O continúa con email
              </span>
            </div>
          </div>

          {/* Email/password tabs */}
          <Tabs defaultValue="login" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-0">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Correo electrónico</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Contraseña</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading || googleLoading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Iniciar sesión
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-0">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Correo electrónico</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Contraseña</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirmar contraseña</Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="••••••••"
                    value={signupConfirm}
                    onChange={(e) => setSignupConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading || googleLoading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Crear cuenta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
