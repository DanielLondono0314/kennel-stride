import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function QueryErrorState({
  title = "Error al cargar datos",
  description = "No se pudo conectar con el servidor. Verifica tu conexión.",
  onRetry,
}: QueryErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
      <div className="p-4 rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="text-center space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      )}
    </div>
  );
}
