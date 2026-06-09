import { LegalLayout, LegalSection } from "./LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout title="Términos del Servicio" updated="9 de junio de 2026">
      <p>
        Estos Términos regulan el uso de KennelOps (el “Servicio”), una plataforma de
        gestión para guarderías y residencias caninas operada por{" "}
        <strong>[NOMBRE_LEGAL_EMPRESA]</strong> (“nosotros”). Al crear una cuenta o usar el
        Servicio, aceptas estos Términos.
      </p>

      <LegalSection n={1} title="Descripción del servicio">
        <p>
          KennelOps permite a negocios gestionar clientes, mascotas, reservas, perreras,
          paquetes, facturación y comunicaciones. El Servicio se ofrece “tal cual”, bajo un
          modelo de suscripción con un período de prueba gratuito.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Cuentas">
        <p>
          Debes proporcionar información veraz al registrarte y eres responsable de mantener
          la confidencialidad de tus credenciales y de toda actividad en tu cuenta. Cada
          organización es responsable de los usuarios que invita y de sus permisos.
        </p>
      </LegalSection>

      <LegalSection n={3} title="Planes, prueba gratuita y pagos">
        <p>
          La suscripción incluye un período de prueba de [DÍAS_PRUEBA] días. Al finalizar, se
          requiere un plan de pago para seguir usando el Servicio. Los pagos se procesan a
          través de <strong>LemonSqueezy</strong>, que actúa como comerciante registrado;
          no almacenamos datos de tarjetas. Las suscripciones se renuevan automáticamente
          hasta que las canceles. Las cancelaciones surten efecto al final del período ya
          pagado. La política de reembolsos es: [POLÍTICA_REEMBOLSOS].
        </p>
      </LegalSection>

      <LegalSection n={4} title="Uso aceptable">
        <p>
          No puedes usar el Servicio para fines ilícitos, vulnerar la seguridad, intentar
          acceder a datos de otras organizaciones, ni revender el Servicio sin autorización.
          Nos reservamos el derecho de suspender cuentas que incumplan estos Términos.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Tus datos y los de tus clientes">
        <p>
          Eres el responsable de los datos que introduces (clientes, mascotas, reservas,
          etc.). Nosotros los tratamos como encargado para prestarte el Servicio, según la
          <a href="/privacidad" className="text-amber-700 underline"> Política de Privacidad</a>.
          Debes contar con base legal para tratar los datos de tus clientes finales.
        </p>
      </LegalSection>

      <LegalSection n={6} title="Disponibilidad y soporte">
        <p>
          Nos esforzamos por mantener el Servicio disponible, pero no garantizamos una
          operación ininterrumpida. Podemos realizar mantenimiento o cambios. El soporte se
          presta a través de [CANAL_SOPORTE].
        </p>
      </LegalSection>

      <LegalSection n={7} title="Limitación de responsabilidad">
        <p>
          En la máxima medida permitida por la ley, el Servicio se ofrece sin garantías y no
          seremos responsables de daños indirectos o lucro cesante. Nuestra responsabilidad
          total se limita a lo pagado por ti en los últimos [MESES_LIMITE] meses.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Terminación">
        <p>
          Puedes cancelar en cualquier momento desde la sección de facturación. Podemos
          suspender o terminar el acceso ante incumplimientos. Tras la terminación, podrás
          exportar tus datos durante [DÍAS_EXPORTACIÓN] días antes de su eliminación.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Cambios en los Términos">
        <p>
          Podemos actualizar estos Términos. Te avisaremos de cambios materiales; el uso
          continuado implica aceptación de la versión vigente.
        </p>
      </LegalSection>

      <LegalSection n={10} title="Ley aplicable y contacto">
        <p>
          Estos Términos se rigen por las leyes de [JURISDICCIÓN]. Para cualquier consulta,
          escríbenos a <strong>[EMAIL_CONTACTO]</strong>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
