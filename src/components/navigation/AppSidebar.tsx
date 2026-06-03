import { useState } from "react";
import { useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppNavLink } from "./AppNavLink";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermission } from "@/hooks/usePermission";
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
  Stethoscope,
  UserCog,
  ListTodo,
} from "lucide-react";

interface AppSidebarProps {
  noticeCount?: number;
  requestCount?: number;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AppSidebar({ noticeCount = 0, requestCount = 0, mobileOpen = false, onMobileClose }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organization } = useOrganization();
  const base = `/${orgSlug}`;
  const canViewReports = usePermission("view_reports");
  const canSendCampaigns = usePermission("send_campaign");
  const canManageSettings = usePermission("manage_settings");
  const canManageTasks = usePermission("manage_tasks");

  return (
    <aside
      className={cn(
        "flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
        mobileOpen
          ? "fixed inset-y-0 left-0 z-40 w-72 flex"
          : "hidden md:flex",
        !mobileOpen && (collapsed ? "md:w-16" : "md:w-64"),
        mobileOpen && "md:relative md:w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary shrink-0">
          <Dog className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sidebar-foreground text-lg leading-tight truncate">
              {organization?.name ?? "KennelOps"}
            </span>
            <span className="text-xs text-sidebar-foreground/60 truncate">
              {orgSlug}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {!collapsed && (
          <p className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Operaciones
          </p>
        )}
        <AppNavLink to={`${base}/dashboard`}    icon={LayoutDashboard} label="Dashboard"     collapsed={collapsed} onClick={onMobileClose} />
        <AppNavLink to={`${base}/requests`}     icon={ClipboardList}   label="Solicitudes"   collapsed={collapsed} badge={requestCount}   onClick={onMobileClose} />
        <AppNavLink to={`${base}/calendar`}     icon={CalendarDays}    label="Calendario"    collapsed={collapsed} onClick={onMobileClose} />
        {canManageTasks && (
          <AppNavLink to={`${base}/tasks`}      icon={ListTodo}        label="Tareas"        collapsed={collapsed} onClick={onMobileClose} />
        )}
        <AppNavLink to={`${base}/facility`}     icon={Map}             label="Instalaciones" collapsed={collapsed} onClick={onMobileClose} />
        <AppNavLink to={`${base}/notices`}      icon={Bell}            label="Avisos"        collapsed={collapsed} badge={noticeCount}    onClick={onMobileClose} />

        {!collapsed && (
          <p className="px-3 mt-6 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            CRM
          </p>
        )}
        <AppNavLink to={`${base}/customers`}    icon={Users}       label="Clientes"      collapsed={collapsed} onClick={onMobileClose} />
        <AppNavLink to={`${base}/dogs`}         icon={Dog}         label="Perros"        collapsed={collapsed} onClick={onMobileClose} />
        <AppNavLink to={`${base}/staff`}        icon={UserCog}     label="Personal"      collapsed={collapsed} onClick={onMobileClose} />
        <AppNavLink to={`${base}/report-cards`} icon={FileText}    label="Report Cards"  collapsed={collapsed} onClick={onMobileClose} />
        <AppNavLink to={`${base}/clinic`}       icon={Stethoscope} label="Clínica"       collapsed={collapsed} onClick={onMobileClose} />

        {!collapsed && (
          <p className="px-3 mt-6 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Finanzas
          </p>
        )}
        <AppNavLink to={`${base}/packages`}     icon={Package}    label="Paquetes"    collapsed={collapsed} onClick={onMobileClose} />
        <AppNavLink to={`${base}/invoices`}     icon={CreditCard} label="Facturación" collapsed={collapsed} onClick={onMobileClose} />

        {!collapsed && (
          <p className="px-3 mt-6 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Analytics
          </p>
        )}
        {canViewReports && (
          <AppNavLink to={`${base}/reports`}    icon={BarChart3}  label="Reportes"  collapsed={collapsed} onClick={onMobileClose} />
        )}
        {canSendCampaigns && (
          <AppNavLink to={`${base}/campaigns`}  icon={Megaphone}  label="Campañas"  collapsed={collapsed} onClick={onMobileClose} />
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2">
        {canManageSettings && (
          <AppNavLink to={`${base}/settings`} icon={Settings} label="Configuración" collapsed={collapsed} onClick={onMobileClose} />
        )}
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
