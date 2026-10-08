import { PAGE_CATALOG, roleCanSeePage } from "@/lib/permissions";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppNavLink } from "./AppNavLink";
import { OrgSwitcher } from "./OrgSwitcher";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermission } from "@/hooks/usePermission";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Dog,
  FileText,
  CalendarCheck,
  CreditCard,
  BarChart3,
  Megaphone,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Bell,
  ClipboardList,
  Map,
  Stethoscope,
  UserCog,
  ListTodo,
  HeartPulse,
  FileSignature,
} from "lucide-react";

interface AppSidebarProps {
  noticeCount?: number;
  requestCount?: number;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  className?: string;
}

export function AppSidebar({ noticeCount = 0, requestCount = 0, mobileOpen = false, onMobileClose, className }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organization, currentRole } = useOrganization();
  // Un título de grupo solo se muestra si el rol ve alguna de sus secciones.
  const showGroup = (group: string) => PAGE_CATALOG.some((p) => p.group === group && roleCanSeePage(currentRole, p.key));
  const base = `/${orgSlug}`;
  const canViewReports = usePermission("view_reports");
  const canSendCampaigns = usePermission("send_campaign");
  const canManageSettings = usePermission("manage_settings");
  const canManageTasks = usePermission("schedule");
  const canBill = usePermission("billing");

  return (
    <aside
      className={cn(
        "flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
        mobileOpen
          ? "fixed inset-y-0 left-0 z-40 w-72 flex"
          : "hidden md:flex",
        !mobileOpen && (collapsed ? "md:w-16" : "md:w-64"),
        mobileOpen && "md:relative md:w-64",
        className
      )}
    >
      {/* Logo + selector de centro */}
      <div className="flex items-center px-2 h-16 border-b border-sidebar-border">
        <OrgSwitcher className="flex w-full min-w-0 items-center gap-3 px-2 py-1.5 hover:bg-sidebar-accent">
          {(interactive) => (
            <>
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary shrink-0">
                <Dog className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
              {!collapsed && (
                <>
                  <div className="flex flex-1 flex-col min-w-0">
                    <span className="font-bold text-sidebar-foreground text-lg leading-tight truncate">
                      {organization?.name ?? "Tails Up"}
                    </span>
                    <span className="text-xs text-sidebar-foreground/60 truncate">
                      {orgSlug}
                    </span>
                  </div>
                  {interactive && <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/50" aria-hidden />}
                </>
              )}
            </>
          )}
        </OrgSwitcher>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {!collapsed && showGroup("Operaciones") && (
          <p className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Operaciones
          </p>
        )}
        <AppNavLink to={`${base}/dashboard`}    icon={LayoutDashboard} label="Dashboard"     collapsed={collapsed} onClick={onMobileClose} page="dashboard" />
        <AppNavLink to={`${base}/requests`}     icon={ClipboardList}   label="Solicitudes"   collapsed={collapsed} badge={requestCount}   feature="requests" onClick={onMobileClose} page="requests" />
        <AppNavLink to={`${base}/calendar`}     icon={CalendarDays}    label="Calendario"    collapsed={collapsed} onClick={onMobileClose} page="calendar" />
        {canManageTasks && (
          <AppNavLink to={`${base}/tasks`}      icon={ListTodo}        label="Tareas"        collapsed={collapsed} onClick={onMobileClose} page="tasks" />
        )}
        <AppNavLink to={`${base}/facility`}     icon={Map}             label="Instalaciones" collapsed={collapsed} feature="facility" onClick={onMobileClose} page="facility" />
        <AppNavLink to={`${base}/notices`}      icon={Bell}            label="Avisos"        collapsed={collapsed} badge={noticeCount}    feature="notices" onClick={onMobileClose} page="notices" />

        {!collapsed && showGroup("CRM") && (
          <p className="px-3 mt-6 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            CRM
          </p>
        )}
        <AppNavLink to={`${base}/customers`}    icon={Users}       label="Clientes"      collapsed={collapsed} onClick={onMobileClose} page="customers" />
        <AppNavLink to={`${base}/dogs`}         icon={Dog}         label="Perros"        collapsed={collapsed} onClick={onMobileClose} page="dogs" />
        <AppNavLink to={`${base}/dog-panel`}    icon={HeartPulse}  label="Panel de perros" collapsed={collapsed} onClick={onMobileClose} page="dog_panel" />
        <AppNavLink to={`${base}/staff`}        icon={UserCog}     label="Personal"      collapsed={collapsed} onClick={onMobileClose} page="staff" />
        <AppNavLink to={`${base}/report-cards`} icon={FileText}    label="Report Cards"  collapsed={collapsed} feature="report_cards" onClick={onMobileClose} page="report_cards" />
        <AppNavLink to={`${base}/clinic`}       icon={Stethoscope} label="Clínica"       collapsed={collapsed} feature="clinic" onClick={onMobileClose} page="clinic" />

        {!collapsed && showGroup("Finanzas") && (
          <p className="px-3 mt-6 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Finanzas
          </p>
        )}
        <AppNavLink to={`${base}/plans`}        icon={CalendarCheck} label="Planes"   collapsed={collapsed} onClick={onMobileClose} page="plans" />
        <AppNavLink to={`${base}/invoices`}     icon={CreditCard} label="Facturación" collapsed={collapsed} onClick={onMobileClose} page="invoices" />
        {(canManageTasks || canBill) && (
          <AppNavLink to={`${base}/contracts`}  icon={FileSignature} label="Contratos" collapsed={collapsed} onClick={onMobileClose} page="contracts" />
        )}

        {!collapsed && showGroup("Analytics") && (
          <p className="px-3 mt-6 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Analytics
          </p>
        )}
        {canViewReports && (
          <AppNavLink to={`${base}/reports`}    icon={BarChart3}  label="Reportes"  collapsed={collapsed} onClick={onMobileClose} page="reports" />
        )}
        {canSendCampaigns && (
          <AppNavLink to={`${base}/campaigns`}  icon={Megaphone}  label="Campañas"  collapsed={collapsed} feature="campaigns" onClick={onMobileClose} page="campaigns" />
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
