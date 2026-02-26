import { Notice, NoticeSeverity } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, ChevronRight, X, CheckCheck } from "lucide-react";

interface NoticesListProps {
  notices: Notice[];
  onAction?: (action: string, params?: Record<string, string>) => void;
  onDismiss?: (noticeId: string) => void;
  onMarkRead?: (noticeId: string) => void;
}

const severityConfig: Record<
  NoticeSeverity,
  { icon: typeof AlertTriangle; className: string; label: string }
> = {
  [NoticeSeverity.CRITICAL]: {
    icon: AlertTriangle,
    className: "notice-critical",
    label: "Crítico",
  },
  [NoticeSeverity.WARNING]: {
    icon: AlertCircle,
    className: "notice-warning",
    label: "Advertencia",
  },
  [NoticeSeverity.INFO]: {
    icon: Info,
    className: "notice-info",
    label: "Info",
  },
};

export function NoticesList({ notices, onAction, onDismiss, onMarkRead }: NoticesListProps) {
  if (notices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Info className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">Todo al día</p>
        <p className="text-sm">No hay avisos pendientes</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notices.map((notice) => {
        const config = severityConfig[notice.severity];
        const Icon = config.icon;

        return (
          <div
            key={notice.id}
            className={cn(
              "p-4 rounded-lg bg-card border transition-all hover:shadow-sm",
              config.className,
              !notice.isRead && "ring-1 ring-primary/20"
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
                      {!notice.isRead && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Nuevo
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {notice.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap mr-1">
                      {formatDistanceToNow(notice.createdAt, {
                        addSuffix: true,
                        locale: es,
                      })}
                    </span>
                    {!notice.isRead && onMarkRead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => onMarkRead(notice.id)}
                        title="Marcar como leído"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onDismiss && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onDismiss(notice.id)}
                        title="Eliminar aviso"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {notice.suggestedActions.length > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    {notice.suggestedActions.map((action, index) => (
                      <Button
                        key={index}
                        size="sm"
                        variant={index === 0 ? "default" : "secondary"}
                        className="h-7 text-xs"
                        onClick={() => onAction?.(action.action, action.params)}
                      >
                        {action.label}
                        {index === 0 && <ChevronRight className="h-3 w-3 ml-1" />}
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
  );
}
