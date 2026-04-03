import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dog, AlertTriangle, ExternalLink } from "lucide-react";

// Replace with your actual LemonSqueezy checkout URLs for each plan
const LS_CHECKOUT_URLS = {
  starter: import.meta.env.VITE_LS_CHECKOUT_STARTER ?? "#",
  growth:  import.meta.env.VITE_LS_CHECKOUT_GROWTH  ?? "#",
};

export default function BillingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-primary">
            <Dog className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
        </div>
        <div className="mx-auto w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-yellow-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Suscripción inactiva</h2>
          <p className="text-muted-foreground mt-2">
            Tu período de prueba ha terminado o la suscripción fue cancelada.
            Activa tu plan para continuar usando KennelOps.
          </p>
        </div>
        <div className="space-y-3">
          <Button className="w-full" asChild>
            <a
              href={LS_CHECKOUT_URLS.growth}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              Activar plan Growth — $179/mes
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <a
              href={LS_CHECKOUT_URLS.starter}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              Activar plan Starter — $79/mes
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Button variant="ghost" className="w-full" asChild>
            <Link to="/login">Volver al inicio</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Pagos procesados de forma segura por{" "}
          <a
            href="https://lemonsqueezy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            LemonSqueezy
          </a>
          . Cancela cuando quieras.
        </p>
      </div>
    </div>
  );
}
