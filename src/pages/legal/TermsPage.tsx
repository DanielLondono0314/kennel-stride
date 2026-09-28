import { LegalLayout, LegalSection, LegalValue, OperatorInfo } from "./LegalLayout";
import { LEGAL, LEGAL_DOCS, operatorName } from "@/lib/legal";

const doc = LEGAL_DOCS.terms;
const link = "text-amber-700 underline";

export default function TermsPage() {
  const op = operatorName();
  return (
    <LegalLayout title={doc.title} updated={doc.updatedAt} version={doc.version}>
      <p>
        Estos Términos y Condiciones (los “Términos”) regulan el acceso y uso de{" "}
        <strong>{LEGAL.brand}</strong> (la “Plataforma”), un software como servicio para la
        gestión de guarderías, hoteles y centros caninos, operado por {op} (“nosotros”). Al crear
        una cuenta, marcar la casilla de aceptación o usar la Plataforma, la persona o empresa
        que la contrata (el “Cliente”) y cada usuario aceptan estos Términos. Esta aceptación
        electrónica tiene plena validez conforme a la Ley 527 de 1999.
      </p>

      <LegalSection n={1} title="Identificación del operador">
        <OperatorInfo />
      </LegalSection>

      <LegalSection n={2} title="Objeto del servicio">
        <p>
          La Plataforma permite gestionar clientes, mascotas, reservas, perreras, tareas, rutas
          de recogida, fichas clínicas, reportes, paquetes, cobros internos y comunicaciones. Las
          funciones disponibles dependen del plan contratado. La Plataforma es una herramienta de
          gestión: la prestación de los servicios de cuidado, transporte, adiestramiento o
          veterinaria a las mascotas es responsabilidad exclusiva de cada Cliente.
        </p>
      </LegalSection>

      <LegalSection n={3} title="Cuentas y usuarios">
        <p>
          El Cliente debe suministrar información veraz, es responsable de la confidencialidad de
          sus credenciales y de toda actividad realizada con ellas, y de los usuarios que invita
          y los roles y permisos que les asigna. Debe informarnos de inmediato cualquier uso no
          autorizado. La Plataforma está dirigida a mayores de edad que actúan en nombre de un
          negocio.
        </p>
      </LegalSection>

      <LegalSection n={4} title="Planes, prueba gratuita y pagos">
        <p>
          Cada organización nueva tiene un período de prueba gratuito de {LEGAL.trialDays} días.
          Al terminar, se requiere un plan de pago para seguir usando las funciones de escritura
          (la información sigue siendo consultable). Los pagos de la suscripción se procesan a
          través de <strong>LemonSqueezy</strong>, que actúa como comerciante registrado; no
          almacenamos datos de tarjetas. Las suscripciones se renuevan automáticamente por
          períodos iguales hasta que el Cliente las cancele; la cancelación surte efecto al final
          del período pagado. Los precios vigentes se publican antes de la compra y los cambios
          de precio se informarán con al menos 30 días de anticipación.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Derecho de retracto y reversión del pago">
        <p>
          Cuando el Cliente tenga la calidad de consumidor en los términos de la Ley 1480 de
          2011, podrá ejercer el derecho de retracto dentro de los cinco (5) días hábiles
          siguientes a la contratación de un plan pagado, escribiendo a{" "}
          <LegalValue value={LEGAL.supportEmail} label="Correo de soporte" />; el dinero se
          devolverá dentro de los treinta (30) días calendario siguientes. También podrá
          solicitar la reversión del pago en los casos del artículo 51 de la misma ley.
        </p>
      </LegalSection>

      <LegalSection n={6} title="Obligaciones y uso aceptable">
        <p>El Cliente y sus usuarios se obligan a no:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Usar la Plataforma para fines ilícitos o contrarios a estos Términos.</li>
          <li>Registrar datos de terceros sin su autorización, datos sensibles o datos de menores de edad.</li>
          <li>Enviar comunicaciones comerciales a quien no lo haya autorizado o se haya opuesto, o fuera de los horarios permitidos por la Ley 2300 de 2023.</li>
          <li>Intentar acceder a información de otras organizaciones, vulnerar la seguridad o sobrecargar la infraestructura.</li>
          <li>Copiar, descompilar, revender o sublicenciar la Plataforma sin autorización escrita.</li>
        </ul>
        <p>Podemos suspender cuentas que incumplan estas reglas, informando el motivo.</p>
      </LegalSection>

      <LegalSection n={7} title="Datos personales">
        <p>
          El tratamiento de los datos de los usuarios se rige por la{" "}
          <a href={LEGAL_DOCS.privacy.path} className={link}>{LEGAL_DOCS.privacy.title}</a>. Respecto de
          los datos que el Cliente registra sobre sus propios clientes y personal, el Cliente es
          el Responsable del Tratamiento y nosotros el Encargado, conforme al{" "}
          <a href={LEGAL_DOCS.data_processing.path} className={link}>{LEGAL_DOCS.data_processing.title}</a>,
          que el administrador de cada organización acepta al crearla. El Cliente declara que
          cuenta con la autorización previa, expresa e informada de esos titulares y que
          responderá frente a ellos y a la autoridad por su obtención.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Comprobantes y facturación del Cliente">
        <p>
          Los comprobantes, recibos y documentos de cobro que el Cliente genera para sus propios
          clientes dentro de la Plataforma son documentos internos de control y{" "}
          <strong>no constituyen factura electrónica de venta</strong> ante la DIAN. El
          cumplimiento de las obligaciones tributarias y de facturación del Cliente es
          responsabilidad suya.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Propiedad intelectual">
        <p>
          La Plataforma, su código, diseño y marcas son de nuestra propiedad o de nuestros
          licenciantes. Se otorga al Cliente una licencia de uso no exclusiva, intransferible y
          limitada a la vigencia de la suscripción. La información que el Cliente registra sigue
          siendo suya.
        </p>
      </LegalSection>

      <LegalSection n={10} title="Disponibilidad y soporte">
        <p>
          Hacemos esfuerzos razonables para mantener la Plataforma disponible y segura, pero no
          garantizamos un funcionamiento ininterrumpido o libre de errores. Podremos realizar
          mantenimientos, preferiblemente en horarios de bajo uso. El soporte se presta por{" "}
          <LegalValue value={LEGAL.supportEmail} label="Correo de soporte" />.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Limitación de responsabilidad">
        <p>
          En la máxima medida permitida por la ley colombiana, no seremos responsables por daños
          indirectos, lucro cesante, pérdida de oportunidades de negocio ni por los servicios que
          el Cliente presta a sus clientes y sus mascotas. Nuestra responsabilidad total frente
          al Cliente por cualquier causa se limita al valor pagado por este en los{" "}
          {LEGAL.liabilityMonths} meses anteriores al hecho que la origina. Esta limitación no
          aplica en casos de dolo o culpa grave ni restringe derechos irrenunciables del
          consumidor.
        </p>
      </LegalSection>

      <LegalSection n={12} title="Terminación y exportación de datos">
        <p>
          El Cliente puede cancelar su suscripción en cualquier momento. Podemos terminar o
          suspender el servicio por incumplimiento grave de estos Términos, previo aviso salvo
          que la ley o la seguridad exijan actuar de inmediato. Terminada la relación, el Cliente
          podrá solicitar la exportación de su información durante {LEGAL.exportDays} días;
          vencido ese plazo, la información será suprimida, salvo deber legal de conservarla.
        </p>
      </LegalSection>

      <LegalSection n={13} title="Modificaciones">
        <p>
          Podemos modificar estos Términos. Los cambios sustanciales se informarán con al menos
          15 días de anticipación por la Plataforma o por correo. Si el Cliente no está de
          acuerdo, puede cancelar antes de su entrada en vigor.
        </p>
      </LegalSection>

      <LegalSection n={14} title="Ley aplicable, controversias y contacto">
        <p>
          Estos Términos se rigen por las leyes de la República de Colombia. Las controversias se
          intentarán resolver primero de manera directa durante treinta (30) días; de no lograrse,
          serán competentes los jueces de <LegalValue value={LEGAL.city} label="Ciudad" />, Colombia, sin
          perjuicio de las acciones de protección al consumidor ante la Superintendencia de
          Industria y Comercio. Contacto: <LegalValue value={LEGAL.supportEmail} label="Correo de soporte" />.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
