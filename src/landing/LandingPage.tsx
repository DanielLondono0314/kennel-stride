import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LEGAL_DOCS, operatorName } from '@/lib/legal';
import {
  Calendar, Users, Stethoscope, CreditCard, Building2,
  BarChart3, Check, ArrowRight, Menu, X, Star,
  Play, ChevronDown, Heart,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   DESIGN SYSTEM — alineado con la app (PRODUCT.md / DESIGN.md): slate + amber
   Primary:   #1b2b4d  (slate — estructura, igual que --primary de la app)
   Accent:    #f59e0b  (amber — acción, igual que --accent)
   Accent tx: #b45309  (amber profundo — texto-acento sobre claro, AA-safe)
   Success:   #16a34a  (verde — salud / éxito, igual que --success)
   Navy bg:   #0f172a  (footer / secciones oscuras, igual que sidebar de la app)
   Body bg:   #f8fafc  (off-white frío, igual que --background)
───────────────────────────────────────────────────────────────────────────── */
const c = {
  navy:        '#0f172a',   // app sidebar night (secciones oscuras)
  navyMid:     '#1b2b4d',   // app --primary (slate)
  blue:        '#1b2b4d',   // color estructural de marca = app --primary
  blueBright:  '#26406e',   // slate más claro (hover)
  blueLight:   '#eef2f8',   // superficie slate-tinted
  orange:      '#f59e0b',   // app --accent (amber)
  orangeLight: '#fef6e7',   // superficie amber-tinted
  accentDeep:  '#b45309',   // amber profundo para TEXTO-acento sobre claro (AA)
  green:       '#16a34a',   // app --success
  greenLight:  '#f0fdf4',
  text:        '#0f172a',   // app --foreground
  textMid:     '#334155',
  muted:       '#6b7280',   // app --muted-foreground
  border:      '#e5e7eb',   // app --border
  bg:          '#f8fafc',   // app --background
  white:       '#ffffff',
};

/* ─── Data ─────────────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    Icon: Calendar,
    title: 'Motor de Reservas',
    body: 'Calendario drag-and-drop con control de capacidad por box. Confirmaciones automáticas, recordatorios por SMS y lista de espera integrados — sin hojas de cálculo.',
    bg: c.blueLight, ic: c.blue,
  },
  {
    Icon: Users,
    title: 'Clientes y Perfiles de Perros',
    body: 'Historial completo del animal, vacunas, alertas de comportamiento y preferencias del dueño en un solo lugar. Conoce a cada perro antes de que llegue.',
    bg: c.orangeLight, ic: c.orange,
  },
  {
    Icon: Stethoscope,
    title: 'Clínica e Historial Médico',
    body: 'Registra medicamentos, notas veterinarias, incidentes y alertas de salud. Señala perros con necesidades especiales y adjunta documentos a su ficha.',
    bg: c.greenLight, ic: c.green,
  },
  {
    Icon: CreditCard,
    title: 'Facturación y Cobros',
    body: 'Facturas automáticas, planes por duración o por sesiones y cobros con LemonSqueezy. Compatible con facturación recurrente para suscripciones de adiestramiento.',
    bg: c.blueLight, ic: c.blue,
  },
  {
    Icon: Building2,
    title: 'Gestión de Instalaciones',
    body: 'Mapea boxes, suites y áreas de entrenamiento. Controla la ocupación en tiempo real, reporta incidencias de mantenimiento y visualiza el aforo de un vistazo.',
    bg: c.orangeLight, ic: c.orange,
  },
  {
    Icon: BarChart3,
    title: 'Reportes y Analítica',
    body: 'Tendencias de ingresos, tasas de ocupación, rendimiento del equipo y retención de clientes — en paneles que puedes leer y actuar sobre ellos de verdad.',
    bg: c.greenLight, ic: c.green,
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Configura tu centro',
    body: 'Mapea el plano de tu kennel, ajusta la capacidad por box o suite e importa tu base de clientes existente. La mayoría de equipos termina en menos de 30 minutos.',
  },
  {
    n: '02',
    title: 'Activa las reservas',
    body: 'Tu portal de reservas para clientes está listo al instante. Incrústalo en tu web o comparte el enlace directo — sin necesidad de programador.',
  },
  {
    n: '03',
    title: 'Gestiona tu operación',
    body: 'Controla los check-ins diarios, envía actualizaciones a los dueños, cobra pagos y revisa el rendimiento — todo desde una sola pantalla.',
  },
];

const PLANS = [
  {
    name: 'Esencial',
    mo: 19,
    desc: 'Para adiestradores, paseadores y profesionales independientes.',
    cta: 'Empezar gratis',
    highlight: false,
    features: [
      'Hasta 200 perros con sus clientes',
      'Agenda y calendario',
      'Rutas de recogida y entrega',
      'Planes por duración o por sesiones',
      'Facturación',
      'Reportes de tu negocio',
      '2 usuarios',
      'Soporte por email',
    ],
  },
  {
    name: 'Pro',
    mo: 49,
    desc: 'Para guarderías y daycares que trabajan con un equipo.',
    cta: 'Empezar gratis',
    highlight: true,
    badge: 'Más popular',
    features: [
      'Todo lo del plan Esencial',
      'Hasta 1.000 perros y 10 usuarios',
      'Solicitudes de reserva de tus clientes',
      'Report Cards para los dueños',
      'Avisos y alertas operativas',
      'Notificaciones de ruta por SMS / WhatsApp',
      'Soporte prioritario',
    ],
  },
  {
    name: 'Premium',
    mo: 99,
    desc: 'Para hoteles, resorts y centros caninos completos.',
    cta: 'Empezar gratis',
    highlight: false,
    features: [
      'Todo lo del plan Pro',
      'Perros y usuarios ilimitados',
      'Instalaciones, perreras y ocupación',
      'Historial médico y clínica veterinaria',
      'Campañas de email marketing',
      'Onboarding acompañado',
      'Soporte prioritario por WhatsApp',
    ],
  },
];

const FAQS = [
  {
    q: '¿Cuánto tiempo tarda la incorporación?',
    a: 'Puedes empezar el mismo día: creas tu centro, importas tus clientes y perros desde Excel o CSV con nuestras plantillas e invitas a tu equipo. Si necesitas ayuda, te acompañamos por email.',
  },
  {
    q: '¿Mis clientes pueden reservar online?',
    a: 'Hoy las reservas las registra tu equipo desde la plataforma, y tus clientes reciben reportes y avisos del servicio. Un portal de reservas para dueños está en nuestra hoja de ruta.',
  },
  {
    q: '¿Admite múltiples sedes?',
    a: 'Para operaciones con varias sedes o franquicias armamos un plan a medida, con calendarios, permisos de personal y reportes independientes por sede. Escríbenos y lo cotizamos.',
  },
  {
    q: '¿Hay contrato o permanencia mínima?',
    a: 'Sin contratos ni permanencia. Los planes son mensuales, se renuevan automáticamente y los cancelas cuando quieras; la cancelación aplica al final del mes pagado. Consulta los Términos y Condiciones para el derecho de retracto.',
  },
  {
    q: '¿Cómo funciona la prueba gratuita?',
    a: '14 días, acceso completo, sin tarjeta de crédito. Pruebas todas las funciones del plan Premium y, al terminar, eliges el plan que se ajusta a tu negocio.',
  },
];


const NAV_LINKS = [
  { label: 'Funciones',   id: 'features' },
  { label: 'Precios',     id: 'pricing' },
  { label: 'FAQ',         id: 'faq' },
];

/* ─── Hooks ─────────────────────────────────────────────────────────────────── */

/** true si el usuario pidió reducir animaciones — el contenido se muestra sin reveal. */
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(prefersReducedMotion);
  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el) return;
    // Above-the-fold: visible de inmediato sin esperar al IntersectionObserver.
    // En pestañas throttled (segundo plano) el callback puede tardar segundos y
    // dejaría el hero en opacity:0; además esto mejora el LCP percibido.
    if (el.getBoundingClientRect().top < window.innerHeight) {
      setSeen(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setSeen(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, seen]);
  return { ref, seen };
}

/* ─── Reveal Wrapper ────────────────────────────────────────────────────────── */

function Reveal({
  children,
  delay = 0,
  y = 26,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const { ref, seen } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: seen ? 1 : 0,
        transform: seen ? 'none' : `translateY(${y}px)`,
        transition: `opacity 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Paw Icon (inline SVG) ────────────────────────────────────────────────── */

function PawIcon({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <ellipse cx="6" cy="7.5" rx="2" ry="2.8" />
      <ellipse cx="18" cy="7.5" rx="2" ry="2.8" />
      <ellipse cx="10" cy="4" rx="1.6" ry="2.2" />
      <ellipse cx="14" cy="4" rx="1.6" ry="2.2" />
      <path d="M12 11c-4.5 0-7.5 2-7.5 5.5C4.5 20 7.5 22 12 22s7.5-2 7.5-5.5C19.5 13 16.5 11 12 11z" />
    </svg>
  );
}

/* ─── Dashboard Mockup ─────────────────────────────────────────────────────── */

function DashboardMockup() {
  const sidebarItems = [
    { Icon: Calendar, active: true },
    { Icon: Users, active: false },
    { Icon: Stethoscope, active: false },
    { Icon: CreditCard, active: false },
    { Icon: Building2, active: false },
    { Icon: BarChart3, active: false },
  ];

  const stats = [
    { label: 'Entradas',   value: '12',  textColor: c.blue,    bg: c.blueLight },
    { label: 'Alojados',   value: '34',  textColor: c.orange,  bg: c.orangeLight },
    { label: 'Salidas',    value: '8',   textColor: c.green,   bg: c.greenLight },
    { label: 'Ocupación',  value: '86%', textColor: '#7C3AED', bg: '#F5F3FF' },
  ];

  const rows = [
    { dog: 'Max', breed: 'Golden Retriever', owner: 'K. Johnson', time: '09:00',  status: 'Confirmada', sc: c.green,    sb: '#F0FDF4' },
    { dog: 'Bella', breed: 'Border Collie', owner: 'R. Martinez', time: '10:30', status: 'Pendiente', sc: '#D97706',  sb: '#FFFBEB' },
    { dog: 'Charlie', breed: 'Labrador',    owner: 'S. Williams', time: '11:00', status: 'Confirmada', sc: c.green,    sb: '#F0FDF4' },
  ];

  return (
    <div
      className="w-full"
      style={{
        maxWidth: 560,
        borderRadius: 14,
        boxShadow: '0 40px 80px rgba(13,33,55,0.22), 0 8px 24px rgba(13,33,55,0.08)',
        overflow: 'hidden',
        border: `1px solid ${c.border}`,
      }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-2 px-4"
        style={{ height: 38, backgroundColor: '#1E293B' }}
      >
        {['#FF5F57', '#FFBD2E', '#28C840'].map((bg) => (
          <div key={bg} style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: bg }} />
        ))}
        <div
          className="flex-1 ml-2 flex items-center px-3"
          style={{ height: 22, backgroundColor: '#334155', borderRadius: 4 }}
        >
          <span style={{ fontSize: 10.5, color: '#94A3B8' }}>tailsup.app/dashboard</span>
        </div>
      </div>

      <div className="flex" style={{ height: 312 }}>
        {/* Sidebar */}
        <div
          className="flex flex-col items-center py-4 gap-4"
          style={{ width: 50, backgroundColor: c.navy, flexShrink: 0 }}
        >
          {sidebarItems.map(({ Icon, active }, i) => (
            <div
              key={i}
              className="flex items-center justify-center cursor-pointer"
              style={{
                width: 32, height: 32, borderRadius: 8,
                backgroundColor: active ? c.blue : 'transparent',
                transition: 'background-color 0.15s',
              }}
            >
              <Icon size={15} color={active ? '#fff' : '#4B6280'} />
            </div>
          ))}
        </div>

        {/* Main content */}
        <div
          className="flex-1 p-4"
          style={{ backgroundColor: c.bg, overflow: 'hidden' }}
        >
          {/* Top bar */}
          <div className="flex justify-between items-start mb-3">
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: c.text, lineHeight: 1.3 }}>Resumen de hoy</p>
              <p style={{ fontSize: 10, color: c.muted }}>Jueves, 3 de abril · 34 perros alojados</p>
            </div>
            <span
              className="flex items-center cursor-pointer"
              style={{
                fontSize: 10, fontWeight: 600,
                backgroundColor: c.blue, color: '#fff',
                padding: '4px 9px', borderRadius: 20,
              }}
            >
              + Nueva reserva
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="text-center"
                style={{ backgroundColor: s.bg, borderRadius: 8, padding: '7px 4px' }}
              >
                <p style={{ fontSize: 15, fontWeight: 800, color: s.textColor, lineHeight: 1.2 }}>{s.value}</p>
                <p style={{ fontSize: 9, color: c.muted, marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div
            style={{
              backgroundColor: c.white, borderRadius: 8,
              border: `1px solid ${c.border}`, overflow: 'hidden',
            }}
          >
            <div
              className="px-3 py-2"
              style={{ borderBottom: `1px solid ${c.border}` }}
            >
              <p style={{ fontSize: 10, fontWeight: 600, color: c.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Próximas entradas
              </p>
            </div>
            {rows.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3"
                style={{
                  paddingTop: 7, paddingBottom: 7,
                  borderBottom: i < rows.length - 1 ? `1px solid ${c.border}` : 'none',
                }}
              >
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: '#E0E7FF' }}
                >
                  <Heart size={10} color={c.blue} fill={c.blue} />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 10, fontWeight: 600, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.dog} <span style={{ color: c.muted, fontWeight: 400 }}>· {r.breed}</span>
                  </p>
                  <p style={{ fontSize: 9, color: c.muted }}>{r.owner}</p>
                </div>
                <p style={{ fontSize: 9, color: c.muted, flexShrink: 0 }}>{r.time}</p>
                <span
                  style={{
                    fontSize: 9, fontWeight: 600, color: r.sc,
                    backgroundColor: r.sb, padding: '2px 6px',
                    borderRadius: 10, flexShrink: 0,
                  }}
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── NavBar ────────────────────────────────────────────────────────────────── */

function NavBar() {
  // Con sesión iniciada, "Iniciar sesión" confunde: /login redirige al panel (QA E-19).
  const { session } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const navLinks = NAV_LINKS;

  return (
    <header
      className="fixed top-0 left-0 right-0"
      style={{
        zIndex: 50,
        backgroundColor: scrolled ? 'rgba(255,255,255,0.97)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? `1px solid ${c.border}` : 'none',
        transition: 'background-color 0.3s, border-color 0.3s',
      }}
    >
      <div
        className="mx-auto flex items-center justify-between px-6"
        style={{ maxWidth: 1200, height: 68 }}
      >
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5 no-underline cursor-pointer">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: c.blue }}
          >
            <PawIcon size={19} color="#fff" />
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, color: c.text, letterSpacing: '-0.02em' }}>
            Tails Up
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              className="text-sm font-medium no-underline"
              style={{ color: c.muted, transition: 'color 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = c.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = c.muted)}
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden md:block text-sm font-medium no-underline px-3 py-2"
            style={{ color: c.text }}
          >
            {session ? 'Ir a mi panel' : 'Iniciar sesión'}
          </Link>
          <Link
            to="/register"
            className="text-sm font-semibold no-underline px-5 py-2.5 rounded-lg cursor-pointer"
            style={{
              backgroundColor: c.blue, color: '#fff',
              boxShadow: '0 4px 12px rgba(27,43,77,0.28)',
              transition: 'background-color 0.2s, transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#26406e';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(27,43,77,0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = c.blue;
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(27,43,77,0.28)';
            }}
          >
            Empezar gratis
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1.5 rounded-md cursor-pointer border-none bg-transparent"
            aria-label="Toggle menu"
          >
            {mobileOpen
              ? <X size={22} color={c.text} />
              : <Menu size={22} color={c.text} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className="md:hidden overflow-hidden"
        style={{
          maxHeight: mobileOpen ? 360 : 0,
          transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1)',
          backgroundColor: c.white,
          borderTop: mobileOpen ? `1px solid ${c.border}` : 'none',
        }}
      >
        <div className="px-6 pt-2 pb-6 flex flex-col gap-0">
          {navLinks.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              onClick={() => setMobileOpen(false)}
              className="block py-3.5 text-base font-medium no-underline"
              style={{ color: c.text, borderBottom: `1px solid ${c.border}` }}
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/register"
            onClick={() => setMobileOpen(false)}
            className="block mt-4 text-center text-sm font-semibold no-underline py-3.5 rounded-xl"
            style={{ backgroundColor: c.blue, color: '#fff' }}
          >
            Empezar gratis
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ─── Hero ──────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ paddingTop: 108, paddingBottom: 88, backgroundColor: c.bg }}
    >
      {/* Dot-grid background */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, #CBD5E1 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
          opacity: 0.5,
        }}
      />
      {/* Soft blue glow top-right */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          top: -100, right: -100, width: 600, height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(27,43,77,0.09) 0%, transparent 65%)',
        }}
      />

      <div className="mx-auto px-6 relative" style={{ maxWidth: 1200 }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left: copy */}
          <div>
            <Reveal>
              <div
                className="inline-flex items-center gap-2 mb-6"
                style={{
                  backgroundColor: c.blueLight,
                  border: `1px solid #BFDBFE`,
                  borderRadius: 100, padding: '5px 14px',
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: c.blue }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: c.blue }}>
                  Ahora con programación impulsada por IA
                </span>
              </div>
            </Reveal>

            <Reveal delay={55}>
              <h1
                className="mb-5"
                style={{
                  fontSize: 'clamp(34px, 5vw, 54px)',
                  fontWeight: 800,
                  color: c.text,
                  lineHeight: 1.1,
                  letterSpacing: '-0.03em',
                }}
              >
                Gestiona tu centro canino<br />
                <span style={{ color: c.accentDeep }}>como lo tenías planeado</span>
              </h1>
            </Reveal>

            <Reveal delay={100}>
              <p
                className="mb-8"
                style={{ fontSize: 18, color: c.muted, lineHeight: 1.72, maxWidth: 480 }}
              >
                Tails Up da a los centros y escuelas de adiestramiento
                una sola plataforma para gestionar reservas, historiales médicos,
                facturación y personal — para que nada se pierda por el camino.
              </p>
            </Reveal>

            <Reveal delay={140}>
              <div className="flex flex-wrap gap-3 mb-10">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 no-underline font-semibold rounded-xl cursor-pointer"
                  style={{
                    backgroundColor: c.blue, color: '#fff',
                    padding: '13px 26px', fontSize: 15,
                    boxShadow: '0 4px 16px rgba(27,43,77,0.35)',
                    transition: 'background-color 0.2s, transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#26406e';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(27,43,77,0.42)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = c.blue;
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(27,43,77,0.35)';
                  }}
                >
                  Empezar gratis
                  <ArrowRight size={16} />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 no-underline font-semibold rounded-xl cursor-pointer"
                  style={{
                    backgroundColor: c.white, color: c.text,
                    padding: '13px 26px', fontSize: 15,
                    border: `1.5px solid ${c.border}`,
                    transition: 'border-color 0.2s, color 0.2s, transform 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = c.blue;
                    e.currentTarget.style.color = c.blue;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = c.border;
                    e.currentTarget.style.color = c.text;
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <Play size={14} color={c.blue} fill={c.blue} />
                  Ver demo de 2 min
                </a>
              </div>
            </Reveal>

            
          </div>

          {/* Right: dashboard mockup */}
          <Reveal delay={200} className="flex justify-center lg:justify-end">
            <DashboardMockup />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── Features ──────────────────────────────────────────────────────────────── */

function Features() {
  return (
    <section id="features" style={{ backgroundColor: c.white, padding: '96px 24px' }}>
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
        <Reveal className="text-center mb-16">
          <p
            style={{
              fontSize: 12, fontWeight: 700, color: c.blue,
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12,
            }}
          >
            Plataforma
          </p>
          <h2
            style={{
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 800, color: c.text,
              letterSpacing: '-0.02em', lineHeight: 1.18, marginBottom: 14,
            }}
          >
            Todo lo que necesita tu centro.<br />Nada más.
          </h2>
          <p style={{ fontSize: 17, color: c.muted, maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>
            Diseñado desde cero para centros de adiestramiento canino —
            no adaptado de una herramienta de agenda genérica.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 55}>
              <div
                className="rounded-2xl p-7 h-full cursor-pointer"
                style={{
                  border: `1.5px solid ${c.border}`,
                  backgroundColor: c.white,
                  transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = f.ic;
                  e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.08)';
                  e.currentTarget.style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = c.border;
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div
                  className="flex items-center justify-center mb-5"
                  style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: f.bg }}
                >
                  <f.Icon size={22} color={f.ic} />
                </div>
                <h3
                  style={{
                    fontSize: 17, fontWeight: 700, color: c.text,
                    marginBottom: 8, letterSpacing: '-0.01em',
                  }}
                >
                  {f.title}
                </h3>
                <p style={{ fontSize: 14.5, color: c.muted, lineHeight: 1.67 }}>{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ──────────────────────────────────────────────────────────── */

function HowItWorks() {
  return (
    <section style={{ backgroundColor: c.bg, padding: '96px 24px' }}>
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
        <Reveal className="text-center mb-16">
          <p
            style={{
              fontSize: 12, fontWeight: 700, color: c.accentDeep,
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12,
            }}
          >
            Cómo funciona
          </p>
          <h2
            style={{
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 800, color: c.text,
              letterSpacing: '-0.02em', lineHeight: 1.18,
            }}
          >
            Operativo desde el primer día
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative">
          {/* Connector (desktop only) */}
          <div
            aria-hidden="true"
            className="hidden md:block absolute"
            style={{
              top: 27, left: '18%', right: '18%',
              height: 1, backgroundColor: c.border,
            }}
          />

          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 80} className="text-center">
              <div
                className="inline-flex items-center justify-center mb-6"
                style={{
                  width: 56, height: 56, borderRadius: '50%',
                  backgroundColor: c.blue,
                  boxShadow: '0 0 0 8px rgba(27,43,77,0.1)',
                  position: 'relative',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{s.n}</span>
              </div>
              <h3
                style={{
                  fontSize: 18, fontWeight: 700, color: c.text,
                  marginBottom: 10, letterSpacing: '-0.01em',
                }}
              >
                {s.title}
              </h3>
              <p style={{ fontSize: 15, color: c.muted, lineHeight: 1.67, maxWidth: 290, margin: '0 auto' }}>
                {s.body}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ───────────────────────────────────────────────────────────────── */

function Pricing() {

  return (
    <section id="pricing" style={{ backgroundColor: c.bg, padding: '96px 24px' }}>
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
        <Reveal className="text-center mb-12">
          <p
            style={{
              fontSize: 12, fontWeight: 700, color: c.blue,
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12,
            }}
          >
            Precios
          </p>
          <h2
            style={{
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 800, color: c.text,
              letterSpacing: '-0.02em', lineHeight: 1.18, marginBottom: 12,
            }}
          >
            Precios simples y transparentes
          </h2>
          <p style={{ fontSize: 17, color: c.muted, marginBottom: 28, lineHeight: 1.65 }}>
            Sin coste de alta. Sin cargos por reserva. Un precio mensual predecible.
          </p>

        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 65}>
              <div
                className="rounded-2xl p-8 h-full flex flex-col relative"
                style={{
                  backgroundColor: p.highlight ? c.navy : c.white,
                  border: p.highlight ? `2px solid ${c.blue}` : `1.5px solid ${c.border}`,
                  boxShadow: p.highlight ? '0 24px 56px rgba(13,33,55,0.22)' : 'none',
                }}
              >
                {/* Popular badge */}
                {p.badge && (
                  <div
                    className="absolute"
                    style={{
                      top: -14, left: '50%', transform: 'translateX(-50%)',
                      backgroundColor: c.blue, color: '#fff',
                      fontSize: 11, fontWeight: 700,
                      padding: '4px 14px', borderRadius: 100,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.badge}
                  </div>
                )}

                <div className="mb-6">
                  <p
                    style={{
                      fontSize: 20, fontWeight: 800,
                      color: p.highlight ? '#fff' : c.text,
                      marginBottom: 5, letterSpacing: '-0.01em',
                    }}
                  >
                    {p.name}
                  </p>
                  <p
                    style={{
                      fontSize: 13.5,
                      color: p.highlight ? '#94A3B8' : c.muted,
                      marginBottom: 16, lineHeight: 1.5,
                    }}
                  >
                    {p.desc}
                  </p>

                  {p.mo !== null ? (
                    <div className="flex items-end gap-1">
                      <span
                        style={{
                          fontSize: 42, fontWeight: 800,
                          color: p.highlight ? '#fff' : c.text,
                          lineHeight: 1, letterSpacing: '-0.03em',
                        }}
                      >
                        ${p.mo}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          color: p.highlight ? '#94A3B8' : c.muted,
                          paddingBottom: 5,
                        }}
                      >
                        USD/mes
                      </span>
                    </div>
                  ) : (
                    <p
                      style={{
                        fontSize: 34, fontWeight: 800,
                        color: p.highlight ? '#fff' : c.text,
                        lineHeight: 1,
                      }}
                    >
                      A medida
                    </p>
                  )}
                </div>

                <ul className="flex flex-col gap-3 mb-8 flex-1 list-none p-0 m-0">
                  {p.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check
                        size={15}
                        color={p.highlight ? '#34D399' : c.green}
                        style={{ flexShrink: 0, marginTop: 2 }}
                      />
                      <span
                        style={{
                          fontSize: 14,
                          color: p.highlight ? '#CBD5E1' : c.textMid,
                          lineHeight: 1.55,
                        }}
                      >
                        {feat}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={p.name === 'Enterprise' ? '#' : '/register'}
                  className="block text-center text-sm font-semibold no-underline py-3.5 rounded-xl cursor-pointer"
                  style={{
                    backgroundColor: p.highlight ? c.blue : 'transparent',
                    color: p.highlight ? '#fff' : c.blue,
                    border: p.highlight ? 'none' : `1.5px solid ${c.blue}`,
                    transition: 'opacity 0.2s, transform 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.85';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  {p.cta}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-8 text-center">
          <p style={{ fontSize: 13.5, color: c.muted }}>
            Todos los planes incluyen 14 días gratis · Sin tarjeta de crédito · Cancela cuando quieras
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── FAQ ───────────────────────────────────────────────────────────────────── */

function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faq" style={{ backgroundColor: c.white, padding: '96px 24px' }}>
      <div className="mx-auto" style={{ maxWidth: 720 }}>
        <Reveal className="text-center mb-14">
          <p
            style={{
              fontSize: 12, fontWeight: 700, color: c.blue,
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12,
            }}
          >
            FAQ
          </p>
          <h2
            style={{
              fontSize: 'clamp(26px, 4vw, 38px)',
              fontWeight: 800, color: c.text,
              letterSpacing: '-0.02em', lineHeight: 1.2,
            }}
          >
            Preguntas frecuentes
          </h2>
        </Reveal>

        <div className="flex flex-col gap-3">
          {FAQS.map((f, i) => (
            <Reveal key={i} delay={i * 35}>
              <div
                className="rounded-xl overflow-hidden cursor-pointer"
                style={{
                  border: `1.5px solid ${openIdx === i ? c.blue : c.border}`,
                  transition: 'border-color 0.2s',
                }}
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
              >
                <div className="flex items-center justify-between px-6 py-4 gap-4">
                  <span style={{ fontSize: 15.5, fontWeight: 600, color: c.text, lineHeight: 1.4 }}>
                    {f.q}
                  </span>
                  <ChevronDown
                    size={18}
                    color={c.muted}
                    style={{
                      flexShrink: 0,
                      transform: openIdx === i ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
                    }}
                  />
                </div>
                <div
                  style={{
                    maxHeight: openIdx === i ? 180 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
                  }}
                >
                  <p
                    className="px-6 pb-5"
                    style={{ fontSize: 14.5, color: c.muted, lineHeight: 1.72 }}
                  >
                    {f.a}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA Banner ────────────────────────────────────────────────────────────── */

function CTABanner() {
  return (
    <section style={{ backgroundColor: c.navy, padding: '88px 24px' }}>
      <div className="mx-auto text-center" style={{ maxWidth: 620 }}>
        <Reveal>
          <h2
            className="mb-4"
            style={{
              fontSize: 'clamp(28px, 4vw, 44px)',
              fontWeight: 800, color: '#fff',
              letterSpacing: '-0.025em', lineHeight: 1.15,
            }}
          >
            ¿Listo para que tu centro<br />funcione como un reloj?
          </h2>
        </Reveal>
        <Reveal delay={60}>
          <p
            className="mb-10"
            style={{ fontSize: 17, color: '#94A3B8', lineHeight: 1.67 }}
          >
            Empieza tu prueba gratuita de 14 días. Acceso completo a todas las funciones.
            Sin tarjeta de crédito. Cancela cuando quieras.
          </p>
        </Reveal>
        <Reveal delay={110}>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 no-underline font-semibold rounded-xl cursor-pointer"
              style={{
                backgroundColor: c.orange, color: '#41200a',
                padding: '14px 28px', fontSize: 15,
                boxShadow: '0 4px 18px rgba(245,158,11,0.38)',
                transition: 'background-color 0.2s, transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#d97706';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 28px rgba(245,158,11,0.48)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = c.orange;
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 18px rgba(245,158,11,0.38)';
              }}
            >
              Empezar gratis
              <ArrowRight size={16} />
            </Link>
            <a
              href="#"
              className="inline-flex items-center gap-2 no-underline font-semibold rounded-xl cursor-pointer"
              style={{
                backgroundColor: 'transparent', color: '#fff',
                padding: '14px 28px', fontSize: 15,
                border: '1.5px solid rgba(255,255,255,0.22)',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.55)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)';
              }}
            >
              Solicitar demo
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Footer ────────────────────────────────────────────────────────────────── */

function Footer() {
  const cols = [
    { heading: 'Producto',  links: ['Funciones', 'Precios', 'Seguridad', 'Novedades', 'Hoja de ruta'] },
    { heading: 'Recursos',  links: ['Documentación', 'Referencia API', 'Estado del servicio', 'Blog'] },
    { heading: 'Empresa',   links: ['Sobre nosotros', 'Empleo', 'Prensa', 'Contacto'] },
  ];

  return (
    <footer
      style={{
        backgroundColor: c.navy,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '56px 24px 32px',
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand column */}
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: c.blue }}
              >
                <PawIcon size={17} color="#fff" />
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
                Tails Up
              </span>
            </div>
            <p style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.67, maxWidth: 210 }}>
              La plataforma todo en uno para centros de pensión y escuelas de adiestramiento canino.
            </p>
          </div>

          {/* Link columns */}
          {cols.map((col) => (
            <div key={col.heading}>
              <p
                style={{
                  fontSize: 11, fontWeight: 700, color: '#475569',
                  textTransform: 'uppercase', letterSpacing: '0.09em',
                  marginBottom: 16,
                }}
              >
                {col.heading}
              </p>
              <ul className="flex flex-col gap-3 list-none p-0 m-0">
                {col.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="no-underline"
                      style={{
                        fontSize: 13.5, color: '#64748B',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#94A3B8')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#64748B')}
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div
          className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p style={{ fontSize: 13, color: '#475569' }}>
            © {new Date().getFullYear()} {operatorName()}. Todos los derechos reservados.
          </p>
          <div className="flex gap-6">
            {[
              { label: 'Tratamiento de datos', href: LEGAL_DOCS.privacy.path },
              { label: 'Términos', href: LEGAL_DOCS.terms.path },
              { label: 'Cookies', href: LEGAL_DOCS.cookies.path },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="no-underline"
                style={{ fontSize: 12.5, color: '#475569', transition: 'color 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#94A3B8')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Root export ───────────────────────────────────────────────────────────── */

export default function LandingPage() {
  // Inject Plus Jakarta Sans
  useEffect(() => {
    const id = 'ko-font-plus-jakarta';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap';
    document.head.appendChild(link);
  }, []);

  return (
    <div
      style={{
        fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
        overflowX: 'hidden',
      }}
    >
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        section { scroll-margin-top: 72px; }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { transition-duration: 0.01ms !important; }
        }
      `}</style>

      <NavBar />

      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <FAQ />
        <CTABanner />
      </main>

      <Footer />
    </div>
  );
}
