import { Suspense } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { usePlatformAdmin } from "@/contexts/PlatformAdminContext";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Building2, ShieldCheck, LogOut } from "lucide-react";

const NAV_ITEMS = [
  { to: "/platform-admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/platform-admin/organizations", label: "Organizaciones", icon: Building2, end: false },
  { to: "/platform-admin/audit-log", label: "Auditoría", icon: ShieldCheck, end: false },
];

export function PlatformAdminLayout() {
  const { platformRole } = usePlatformAdmin();
  const { user, signOut } = useAuth();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-4 py-5 border-b border-sidebar-border">
          <p className="font-semibold text-sm">KennelStride</p>
          <p className="text-xs text-sidebar-foreground/60">Panel de plataforma</p>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-sidebar-border space-y-2">
          <div className="px-1 text-xs text-sidebar-foreground/60 truncate">{user?.email}</div>
          <Badge variant="outline" className="text-[10px]">
            {platformRole === "owner" ? "Owner" : "Solo lectura"}
          </Badge>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
