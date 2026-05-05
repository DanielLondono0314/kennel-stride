import { useState, useEffect, useCallback } from "react";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Bell, Loader2, AlertTriangle, AlertCircle, Info,
  CheckCheck, X, ChevronRight, RefreshCw, Trash2,
} from "lucide-react";

interface NoticeRow {
  id: string;
  title: string;
  message: string;
  severity: string;
  entity_type: string;
  entity_id: string | null;
  suggested_actions: any[];
  is_read: boolean;
  is_dismissed: boolean;
  auto_generated: boolean;
  created_at: string;
}

const severityConfig: Record<string, { icon: typeof AlertTriangle; className: string; label: string }> = {
  critical: { icon: AlertTriangle, className: "notice-critical", label: "Crítico" },
  warning: { icon: AlertCircle, className: "notice-warning", label: "Advertencia" },
  info: { icon: Info, className: "notice-info", label: "Info" },
};

export default function NoticesPage() {
  const navigate = useOrgNavigate();
  const { organization } = useOrganization();
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [showRead, setShowRead] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotices = useCallback(async () => {
    if (!organization) return;
    setLoading(true);
    let query = supabase.from("notices").select("*").eq("is_dismissed", false).eq("organization_id", organization!.id).order("created_at", { ascending: false });
    const { data } = await query;
    setNotices((data || []) as NoticeRow[]);
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  // Subscribe to realtime notices — filtered by org so other orgs' notices never arrive
  useEffect(() => {
    if (!organization) return;
    const channel = supabase
      .channel(`notices-${organization.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notices",
          filter: `organization_id=eq.${organization.id}`,
        },
        (payload) => {
          setNotices((prev) => [payload.new as NoticeRow, ...prev]);
          toast.info("Nuevo aviso", { description: (payload.new as NoticeRow).title });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [organization?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Trigger backend check functions
    await supabase.rpc("check_expiring_packages");
    await supabase.rpc("check_overdue_invoices");
    await fetchNotices();
    setRefreshing(false);
    toast.success("Avisos actualizados");
  };

  const markRead = async (id: string) => {
    await supabase.from("notices").update({ is_read: true }).eq("id", id);
    setNotices((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    if (!organization) return;
    await supabase
      .from("notices")
      .update({ is_read: true })
      .eq("organization_id", organization.id)
      .eq("is_read", false);
    setNotices((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success("Todos marcados como leídos");
  };

  const dismiss = async (id: string) => {
    await supabase.from("notices").update({ is_dismissed: true }).eq("id", id);
    setNotices((prev) => prev.filter((n) => n.id !== id));
  };

  const dismissAll = async () => {
    const readIds = notices.filter((n) => n.is_read).map((n) => n.id);
    if (readIds.length === 0) return;
    await supabase.from("notices").update({ is_dismissed: true }).in("id", readIds);
    setNotices((prev) => prev.filter((n) => !n.is_read));
    toast.success("Avisos leídos eliminados");
  };

  const handleAction = async (action: string, params?: Record<string, string>) => {
    switch (action) {
      case "navigate":
        if (params?.path) navigate(params.path);
        break;
      case "contact":
        if (params?.customerId) {
          navigate(`/customers/${params.customerId}`);
        } else {
          navigate("/customers");
        }
        break;
      case "sendReminder": {
        if (!organization || !params?.customerId) {
          toast.error("No se pudo enviar el recordatorio");
          return;
        }
        const { data: customer } = await supabase
          .from("customers")
          .select("first_name, last_name, email")
          .eq("id", params.customerId)
          .eq("organization_id", organization.id)
          .maybeSingle();
        if (!customer) {
          toast.error("Cliente no encontrado");
          return;
        }
        const { error } = await supabase.from("notices").insert({
          title: "Recordatorio enviado",
          message: `Se registró un recordatorio para ${customer.first_name} ${customer.last_name} (${customer.email}).`,
          severity: "info",
          entity_type: "customer",
          entity_id: params.customerId,
          auto_generated: false,
          organization_id: organization.id,
        });
        if (error) toast.error("Error al registrar recordatorio");
        else toast.success("Recordatorio registrado en el historial");
        break;
      }
      case "renewPackage":
        navigate("/packages");
        break;
      default:
        toast.info(`Acción: ${action}`);
    }
  };

  const filtered = notices.filter((n) => {
    if (severityFilter !== "all" && n.severity !== severityFilter) return false;
    if (!showRead && n.is_read) return false;
    return true;
  });

  const unreadCount = notices.filter((n) => !n.is_read).length;
  const criticalCount = notices.filter((n) => n.severity === "critical" && !n.is_read).length;
  const warningCount = notices.filter((n) => n.severity === "warning" && !n.is_read).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Avisos
            {unreadCount > 0 && (
              <Badge className="bg-destructive text-destructive-foreground">{unreadCount}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground">Centro de notificaciones y alertas automáticas</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Verificar Alertas</span>
            <span className="sm:hidden">Verificar</span>
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Marcar Todo Leído</span>
              <span className="sm:hidden">Marcar leídos</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={dismissAll} className="text-muted-foreground">
            <Trash2 className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Limpiar Leídos</span>
            <span className="sm:hidden">Limpiar</span>
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold">{criticalCount}</p>
                <p className="text-xs text-muted-foreground">Críticos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10"><AlertCircle className="h-5 w-5 text-warning" /></div>
              <div>
                <p className="text-2xl font-bold">{warningCount}</p>
                <p className="text-xs text-muted-foreground">Advertencias</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10"><Bell className="h-5 w-5 text-info" /></div>
              <div>
                <p className="text-2xl font-bold">{unreadCount}</p>
                <p className="text-xs text-muted-foreground">Sin Leer</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las severidades</SelectItem>
            <SelectItem value="critical">Críticos</SelectItem>
            <SelectItem value="warning">Advertencias</SelectItem>
            <SelectItem value="info">Informativos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={showRead ? "secondary" : "outline"} size="sm" onClick={() => setShowRead(!showRead)}>
          {showRead ? "Ocultando leídos" : "Mostrar leídos"}
        </Button>
      </div>

      {/* Notices list */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bell className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">Todo al día</p>
          <p className="text-sm">No hay avisos pendientes</p>
        </div>
      ) : (
        <div className="space-y-2 max-w-3xl">
          {filtered.map((notice) => {
            const config = severityConfig[notice.severity] || severityConfig.info;
            const Icon = config.icon;
            const actions = Array.isArray(notice.suggested_actions) ? notice.suggested_actions : [];

            return (
              <div
                key={notice.id}
                className={cn(
                  "p-4 rounded-lg bg-card border transition-all hover:shadow-sm",
                  config.className,
                  !notice.is_read && "ring-1 ring-primary/20"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 mt-0.5">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{notice.title}</h4>
                          {!notice.is_read && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Nuevo</Badge>
                          )}
                          {notice.auto_generated && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Auto</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{notice.message}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground whitespace-nowrap mr-1">
                          {formatDistanceToNow(new Date(notice.created_at), { addSuffix: true, locale: es })}
                        </span>
                        {!notice.is_read && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => markRead(notice.id)} title="Marcar como leído">
                            <CheckCheck className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => dismiss(notice.id)} title="Eliminar">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {actions.length > 0 && (
                      <div className="flex items-center gap-2 mt-3">
                        {actions.map((action: any, idx: number) => (
                          <Button
                            key={idx}
                            size="sm"
                            variant={idx === 0 ? "default" : "secondary"}
                            className="h-7 text-xs"
                            onClick={() => handleAction(action.action, action.params)}
                          >
                            {action.label}
                            {idx === 0 && <ChevronRight className="h-3 w-3 ml-1" />}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
