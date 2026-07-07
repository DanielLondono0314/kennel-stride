import { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sentry } from "@/lib/sentry";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, eventId: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Chunk viejo tras un deploy: el asset del build anterior ya no existe en
    // el CDN. Recargar UNA vez trae el index nuevo con las rutas correctas.
    // (Sin el guard de sessionStorage, un fallo persistente entraría en bucle.)
    if (/Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(error.message)) {
      const key = "chunk-reload-once";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return;
      }
    }
    const eventId = Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
    this.setState({ eventId: eventId ?? null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md text-center space-y-4 p-8">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold">Algo salió mal</h1>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message || "Error inesperado de la aplicación."}
            </p>
            {this.state.eventId && (
              <p className="text-xs text-muted-foreground">
                Referencia: {this.state.eventId}
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <Button onClick={() => this.setState({ hasError: false, error: null, eventId: null })}>
                Intentar de nuevo
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Recargar página
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
