import { LegalLayout, LegalSection } from "./LegalLayout";

export default function PrivacyPage() {
  return (
    <LegalLayout title="Política de Privacidad" updated="9 de junio de 2026">
      <p>
        Esta Política explica cómo <strong>[NOMBRE_LEGAL_EMPRESA]</strong> (“nosotros”) trata
        los datos personales en KennelOps. Para los datos de tus clientes finales que tú
        introduces en la plataforma, tú eres el responsable y nosotros actuamos como
        encargado del tratamiento.
      </p>

      <LegalSection n={1} title="Datos que recopilamos">
        <p>
          <strong>De tu cuenta:</strong> nombre, email, organización, rol.{" "}
          <strong>Que tú introduces:</strong> datos de tus clientes y de sus mascotas
          (nombre, contacto, información clínica como alergias o medicación, reservas,
          facturas). <strong>De pago:</strong> gestionados por LemonSqueezy; no almacenamos
          números de tarjeta. <strong>Técnicos:</strong> registros de uso y errores para
          operar y mejorar el Servicio.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Para qué los usamos">
        <p>
          Prestar y mantener el Servicio, procesar pagos, enviar correos transaccionales
          (confirmación, recuperación de contraseña, invitaciones), dar soporte, garantizar
          la seguridad y cumplir obligaciones legales.
        </p>
      </LegalSection>

      <LegalSection n={3} title="Proveedores que tratan datos por nosotros">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Supabase</strong> — base de datos y autenticación (alojamiento de los datos).</li>
          <li><strong>Vercel</strong> — alojamiento del frontend.</li>
          <li><strong>LemonSqueezy</strong> — procesamiento de pagos y suscripciones.</li>
          <li><strong>Resend</strong> — envío de correos.</li>
          <li><strong>Sentry</strong> — registro de errores para fiabilidad.</li>
          <li>[OTROS_PROVEEDORES — p. ej. analítica, si aplica].</li>
        </ul>
        <p>
          Cada proveedor trata los datos según sus propias condiciones y solo para prestarnos
          su servicio.
        </p>
      </LegalSection>

      <LegalSection n={4} title="Cookies y tecnologías similares">
        <p>
          Usamos almacenamiento del navegador para mantener tu sesión y preferencias.
          [Si se añade analítica, describir aquí las cookies analíticas y el consentimiento.]
        </p>
      </LegalSection>

      <LegalSection n={5} title="Conservación">
        <p>
          Conservamos los datos mientras tu cuenta esté activa y durante el tiempo necesario
          para cumplir obligaciones legales. Tras la baja, los eliminamos transcurrido el
          período de exportación indicado en los Términos.
        </p>
      </LegalSection>

      <LegalSection n={6} title="Seguridad">
        <p>
          Aplicamos aislamiento por organización a nivel de base de datos (RLS), cifrado en
          tránsito y controles de acceso por rol. Ningún sistema es 100% infalible, pero
          trabajamos para proteger tu información.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Tus derechos">
        <p>
          Puedes solicitar acceso, rectificación o eliminación de tus datos personales, así
          como la exportación de los datos de tu organización, escribiendo a{" "}
          <strong>[EMAIL_CONTACTO]</strong>.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Menores">
        <p>El Servicio está dirigido a negocios y no a menores de edad.</p>
      </LegalSection>

      <LegalSection n={9} title="Cambios y contacto">
        <p>
          Podemos actualizar esta Política y te avisaremos de cambios materiales. Para
          cualquier consulta sobre privacidad: <strong>[EMAIL_CONTACTO]</strong>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
