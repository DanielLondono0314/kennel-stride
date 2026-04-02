import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dog, CalendarDays, Users, CreditCard, Stethoscope, BarChart3, ArrowRight, Check } from "lucide-react";

const features = [
  { icon: CalendarDays, title: "Reservas en tiempo real", desc: "Calendar de reservas, check-in/check-out y estado de cada perro de un vistazo." },
  { icon: Users, title: "CRM completo", desc: "Gestiona clientes, perros, historial y comunicación en un solo lugar." },
  { icon: CreditCard, title: "Facturación y paquetes", desc: "Facturas automáticas, paquetes de sesiones y control de saldo por cliente." },
  { icon: Stethoscope, title: "Historial clínico", desc: "Vacunas, desparasitación, condiciones médicas y temperamento por perro." },
  { icon: BarChart3, title: "Reportes y campañas", desc: "Analítica de tu negocio y herramientas de marketing para retener clientes." },
  { icon: Dog, title: "Report Cards", desc: "Envía reportes de progreso a los dueños con fotos y puntuaciones." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
              <Dog className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">KennelOps</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link to="/login">Iniciar sesión</Link></Button>
            <Button asChild><Link to="/register">Empezar gratis</Link></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center space-y-6">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium">
          14 días gratis · Sin tarjeta de crédito
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
          El software para<br />
          <span className="text-primary">centros caninos</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Gestiona reservas, clientes, facturación e historial médico de todos tus perros desde un solo panel.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button size="lg" className="h-12 px-8 text-base" asChild>
            <Link to="/register">
              Empezar gratis
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
            <Link to="/login">Ver demo</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Todo lo que necesita tu centro</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="border rounded-xl p-6 space-y-3 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Precio simple y transparente</h2>
        <div className="max-w-sm mx-auto border rounded-2xl p-8 shadow-lg space-y-6">
          <div>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Plan Profesional</p>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-4xl font-bold">$49</span>
              <span className="text-muted-foreground">/mes</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Por centro · Usuarios ilimitados</p>
          </div>
          <ul className="space-y-3">
            {[
              "Reservas y calendario",
              "CRM de clientes y perros",
              "Facturación y paquetes",
              "Historial clínico completo",
              "Report Cards con fotos",
              "Reportes y campañas",
              "Soporte por email",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <Button className="w-full h-11" asChild>
            <Link to="/register">Empezar 14 días gratis</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © 2025 KennelOps · <a href="mailto:soporte@kennelops.com" className="hover:underline">soporte@kennelops.com</a>
      </footer>
    </div>
  );
}
