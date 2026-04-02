import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dog, AlertTriangle } from "lucide-react";

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
            Tu período de prueba ha terminado o la suscripción fue cancelada. Activa tu plan para continuar usando KennelOps.
          </p>
        </div>
        <div className="space-y-3">
          <Button className="w-full" asChild>
            <a href="mailto:soporte@kennelops.com">Contactar soporte</a>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/login">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
