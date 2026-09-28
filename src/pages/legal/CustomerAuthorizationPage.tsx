import { Printer } from "lucide-react";
import { LegalLayout, LegalSection } from "./LegalLayout";
import { LEGAL } from "@/lib/legal";

const blank = "inline-block min-w-[12rem] border-b border-slate-400";

/** Modelo de autorización (Ley 1581) que cada guardería hace firmar a sus clientes. */
export default function CustomerAuthorizationPage() {
  return (
    <LegalLayout title="Autorización para el tratamiento de datos personales" updated="29 de septiembre de 2026">
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm print:hidden">
        <p>
          <strong>Para la guardería:</strong> este es un modelo que puedes imprimir o adaptar para
          que tus clientes lo firmen (en papel o formulario digital) antes de registrarlos en{" "}
          {LEGAL.brand}. Conserva el soporte firmado: la ley te exige poder probar la
          autorización. Completa los espacios con los datos de tu negocio.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#1b2b4d] px-3 py-2 text-white hover:bg-[#1b2b4d]/90"
        >
          <Printer className="h-4 w-4" /> Imprimir
        </button>
      </div>

      <p>
        Yo, <span className={blank}>&nbsp;</span>, identificado(a) con documento No.{" "}
        <span className={blank}>&nbsp;</span>, en calidad de titular de mis datos personales y
        responsable de la(s) mascota(s) <span className={blank}>&nbsp;</span>, autorizo de manera
        previa, expresa e informada a <span className={blank}>&nbsp;</span> (nombre del
        establecimiento), NIT <span className={blank}>&nbsp;</span>, con domicilio en{" "}
        <span className={blank}>&nbsp;</span> (en adelante, el “Responsable”), para tratar mis
        datos personales conforme a la Ley 1581 de 2012 y al Decreto 1074 de 2015.
      </p>

      <LegalSection n={1} title="Datos que se tratarán">
        <p>
          Nombre, documento, teléfono, correo electrónico, dirección, contacto de emergencia,
          historial de servicios y pagos, y la información de mi(s) mascota(s) (datos de salud
          animal, vacunas, alergias, medicación, fotografías).
        </p>
      </LegalSection>

      <LegalSection n={2} title="Finalidades">
        <ul className="list-disc space-y-1 pl-5">
          <li>Prestar los servicios contratados (guardería, hotel, adiestramiento, peluquería, transporte u otros) y gestionar reservas.</li>
          <li>Contactarme sobre el cuidado y la salud de mi mascota, incluidas emergencias.</li>
          <li>Enviarme reportes, fotografías y avisos del servicio (correo, SMS o WhatsApp).</li>
          <li>Gestionar pagos, paquetes y cobros.</li>
          <li>Coordinar la recogida y entrega de mi mascota en la dirección que indique.</li>
          <li>Cumplir obligaciones legales.</li>
        </ul>
      </LegalSection>

      <LegalSection n={3} title="Encargado del tratamiento">
        <p>
          Entiendo que el Responsable usa la plataforma {LEGAL.brand}, que almacena y procesa mis
          datos como encargado, con proveedores ubicados en Estados Unidos, bajo obligaciones de
          confidencialidad y seguridad.
        </p>
      </LegalSection>

      <LegalSection n={4} title="Mis derechos">
        <p>
          Conozco que puedo conocer, actualizar, rectificar y suprimir mis datos, solicitar prueba
          de esta autorización, revocarla, ser informado del uso dado a mis datos y presentar
          quejas ante la Superintendencia de Industria y Comercio. Puedo ejercerlos escribiendo a{" "}
          <span className={blank}>&nbsp;</span> (correo del establecimiento). Las consultas se
          responden en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Comunicaciones publicitarias (opcional)">
        <p>Marque una opción. Esta autorización es independiente y no condiciona el servicio:</p>
        <p>☐ SÍ &nbsp;&nbsp; ☐ NO autorizo recibir promociones, novedades y campañas del Responsable por correo, SMS o WhatsApp, en los horarios permitidos por la Ley 2300 de 2023. Puedo retirar esta autorización en cualquier momento.</p>
      </LegalSection>

      <div className="grid gap-8 pt-6 sm:grid-cols-2">
        <p>Firma: <span className={blank}>&nbsp;</span></p>
        <p>Fecha: <span className={blank}>&nbsp;</span></p>
      </div>
    </LegalLayout>
  );
}
