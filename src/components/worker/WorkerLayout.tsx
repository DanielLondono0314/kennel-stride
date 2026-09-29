import { Link, Outlet } from "react-router-dom";
import { UserCircle } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";
import { WorkerBottomNav } from "./WorkerBottomNav";

export function WorkerLayout() {
  const { organization } = useOrganization();
  const base = useOrgBasePath();
  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Perfil arriba a la derecha: la barra inferior queda para el trabajo diario. */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-md items-center justify-between px-4">
          <span className="truncate text-sm font-semibold">{organization?.name}</span>
          <Link to={`${base}/worker/profile`} aria-label="Mi perfil" className="rounded-full p-1 text-muted-foreground hover:text-foreground">
            <UserCircle className="h-6 w-6" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 pt-4">
        <Outlet />
      </main>
      <WorkerBottomNav />
    </div>
  );
}
