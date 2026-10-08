import { Link, Navigate, useNavigate } from "react-router-dom";
import { ChevronRight, Dog, Loader2, LogOut, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMyOrganizations } from "@/hooks/queries/useMyOrganizations";
import { getLastOrgSlug } from "@/lib/orgNavigation";
import { Button } from "@/components/ui/button";

/**
 * "Mis centros": quien pertenece a varios centros (un trabajador freelance, el
 * dueño de varias sedes) elige en cuál entrar. Cada centro conserva sus propios
 * datos; aquí solo se navega.
 */
export default function SelectOrganizationPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: orgs, isLoading, isError, refetch } = useMyOrganizations();
  const lastSlug = getLastOrgSlug();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !orgs) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-muted-foreground">No se pudieron cargar tus centros.</p>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    );
  }

  if (orgs.length === 0) return <Navigate to="/onboarding" replace />;
  if (orgs.length === 1) return <Navigate to={`/${orgs[0].slug}`} replace />;

  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Dog className="h-6 w-6 text-primary-foreground" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold">Elige un centro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.email} tiene acceso a {orgs.length} centros
          </p>
        </div>

        <ul className="space-y-2">
          {orgs.map((o) => (
            <li key={o.slug}>
              <button
                type="button"
                onClick={() => navigate(`/${o.slug}`)}
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {o.logoUrl ? (
                  <img src={o.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary" aria-hidden>
                    {o.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{o.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {o.roleName}
                    {o.slug === lastSlug && " · Último usado"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col items-center gap-2">
          <Button variant="ghost" asChild className="gap-2 text-muted-foreground">
            <Link to="/onboarding">
              <Plus className="h-4 w-4" />
              Crear otro centro o sede
            </Link>
          </Button>
          <Button variant="ghost" onClick={signOut} className="gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </main>
  );
}
