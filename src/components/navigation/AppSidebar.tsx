import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppNavLink } from "./AppNavLink";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Dog,
  FileText,
  Package,
  CreditCard,
  BarChart3,
  Megaphone,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  ClipboardList,
  Map,
} from "lucide-react";

interface AppSidebarProps {
  noticeCount?: number;
  requestCount?: number;
}

export function AppSidebar({ noticeCount = 0, requestCount = 0 }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary">
          <Dog className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-bold text-sidebar-foreground text-lg leading-tight">
              KennelOps
            </span>
            <span className="text-xs text-sidebar-foreground/60">
              Centro de Adiestramiento
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {/* Operations */}
        {!collapsed && (
          <p className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Operaciones
          </p>
        )}
        <AppNavLink to="/" icon={LayoutDashboard} label="Dashboard" collapsed={collapsed} />
        <AppNavLink to="/requests" icon={ClipboardList} label="Solicitudes" collapsed={collapsed} badge={requestCount} />
        <AppNavLink to="/calendar" icon={CalendarDays} label="Calendario" collapsed={collapsed} />
        <AppNavLink to="/facility" icon={Map} label="Instalaciones" collapsed={collapsed} />
        <AppNavLink to="/notices" icon={Bell} label="Avisos" collapsed={collapsed} badge={noticeCount} />

        {/* CRM */}
        {!collapsed && (
          <p className="px-3 mt-6 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            CRM
          </p>
        )}
        <AppNavLink to="/customers" icon={Users} label="Clientes" collapsed={collapsed} />
        <AppNavLink to="/dogs" icon={Dog} label="Perros" collapsed={collapsed} />
        <AppNavLink to="/report-cards" icon={FileText} label="Report Cards" collapsed={collapsed} />

        {/* Finanzas */}
        {!collapsed && (
          <p className="px-3 mt-6 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Finanzas
          </p>
        )}
        <AppNavLink to="/packages" icon={Package} label="Paquetes" collapsed={collapsed} />
        <AppNavLink to="/invoices" icon={CreditCard} label="Facturación" collapsed={collapsed} />

        {/* Analytics */}
        {!collapsed && (
          <p className="px-3 mt-6 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Analytics
          </p>
        )}
        <AppNavLink to="/reports" icon={BarChart3} label="Reportes" collapsed={collapsed} />
        <AppNavLink to="/campaigns" icon={Megaphone} label="Campañas" collapsed={collapsed} />
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2">
        <AppNavLink to="/settings" icon={Settings} label="Configuración" collapsed={collapsed} />
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span>Colapsar</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
