import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dog, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [centerName, setCenterName] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (centerName) setSlug(toSlug(centerName));
  }, [centerName]);

  useEffect(() => {
    if (!slug) { setSlugAvailable(null); return; }
    setChecking(true);
    const timer = setTimeout(async () => {
      const { data } = await (supabase as any)
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      setSlugAvailable(!data);
      setChecking(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!slugAvailable) { toast.error("El slug ya está en uso"); return; }

    setLoading(true);
    const { data: org, error: orgError } = await (supabase as any)
      .rpc("create_organization", { p_name: centerName, p_slug: slug });

    if (orgError) {
      toast.error(`Error al crear el centro: ${orgError.message}`);
      setLoading(false);
      return;
    }

    toast.success("¡Centro creado!");
    navigate(`/${org.slug}/dashboard`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-primary">
            <Dog className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <span className="font-bold text-xl">KennelOps</span>
        </div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configura tu centro</h2>
          <p className="text-muted-foreground mt-1">Esta información aparecerá en tu cuenta y en la URL de acceso.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="centerName">Nombre del centro *</Label>
            <Input
              id="centerName"
              placeholder="Ej: Centro Canino Huellitas"
              value={centerName}
              onChange={(e) => setCenterName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">
              URL de acceso *
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">app.kennelops.com/</span>
              <div className="relative flex-1">
                <Input
                  id="slug"
                  placeholder="mi-centro"
                  value={slug}
                  onChange={(e) => setSlug(toSlug(e.target.value))}
                  required
                  className={
                    slugAvailable === false
                      ? "border-destructive pr-8"
                      : slugAvailable === true
                      ? "border-green-500 pr-8"
                      : "pr-8"
                  }
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {!checking && slugAvailable === true && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {!checking && slugAvailable === false && <span className="text-destructive text-xs">En uso</span>}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Solo letras, números y guiones.</p>
          </div>

          <Button type="submit" className="w-full h-11" disabled={loading || !slugAvailable}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Crear centro y entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
