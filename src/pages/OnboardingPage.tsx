import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dog, Loader2, CheckCircle2 } from "lucide-react";
// Loader2 still used in form submit button & slug spinner
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
      const { data } = await (supabase)
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
    if (!slug.trim()) { toast.error("El URL de acceso no puede estar vacío"); return; }
    // Espeja la validación del RPC create_organization (3–40, minúsculas/números/guiones).
    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) {
      toast.error("URL inválido: usa 3–40 caracteres, solo minúsculas, números y guiones");
      return;
    }
    if (checking) { toast.error("Espera mientras se verifica la disponibilidad del URL"); return; }
    if (!slugAvailable) { toast.error("El slug ya está en uso, elige otro"); return; }

    setLoading(true);

    // Re-verify slug availability right before insert to prevent TOCTOU race
    // (two tabs checking at the same time could both see it as available)
    const { data: existingOrg } = await (supabase)
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingOrg) {
      toast.error("El slug ya fue tomado. Por favor elige otro.");
      setSlugAvailable(false);
      setLoading(false);
      return;
    }

    const { data: org, error: orgError } = await (supabase)
      .rpc("create_organization", { p_name: centerName, p_slug: slug });

    if (orgError) {
      // Handle unique constraint violation from the DB (last line of defence)
      if (orgError.code === "23505" || orgError.message?.includes("unique") || orgError.message?.includes("duplicate")) {
        toast.error("El slug ya está en uso. Por favor elige otro nombre.");
        setSlugAvailable(false);
      } else {
        toast.error(`Error al crear el centro: ${orgError.message}`);
      }
      setLoading(false);
      return;
    }

    const orgData = org as { slug?: string } | null;
    if (!orgData?.slug) {
      toast.error("Error inesperado: no se recibió el slug del centro creado.");
      setLoading(false);
      return;
    }

    toast.success("¡Centro creado!");
    navigate(`/${orgData.slug}/dashboard`);
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
