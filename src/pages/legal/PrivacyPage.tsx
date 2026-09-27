import { LegalLayout, LegalSection, LegalValue, OperatorInfo } from "./LegalLayout";
import { CUSTOMER_AUTHORIZATION_PATH, LEGAL, LEGAL_DOCS, operatorName } from "@/lib/legal";

const doc = LEGAL_DOCS.privacy;

export default function PrivacyPage() {
  const op = operatorName();
  return (
    <LegalLayout title={doc.title} updated={doc.updatedAt} version={doc.version}>
      <p>
        Esta Política se expide en cumplimiento de la Ley Estatutaria 1581 de 2012, el Decreto
        1074 de 2015 (Capítulo 25, que compila el Decreto 1377 de 2013) y demás normas que las
        modifiquen o complementen. Regula la recolección, almacenamiento, uso, circulación,
        transmisión, transferencia y supresión de los datos personales tratados a través de la
        plataforma <strong>{LEGAL.brand}</strong> (la “Plataforma”).
      </p>

      <LegalSection n={1} title="Responsable del Tratamiento">
        <OperatorInfo />
      </LegalSection>

      <LegalSection n={2} title="Definiciones">
        <p>
          Para efectos de esta Política se aplican las definiciones del artículo 3 de la Ley 1581
          de 2012 y del Decreto 1074 de 2015, en especial: <strong>Titular</strong> (persona
          natural cuyos datos son objeto de tratamiento), <strong>Responsable</strong> (quien
          decide sobre la base de datos y el tratamiento), <strong>Encargado</strong> (quien
          realiza el tratamiento por cuenta del Responsable), <strong>Autorización</strong>{" "}
          (consentimiento previo, expreso e informado del Titular), <strong>Transmisión</strong>{" "}
          (comunicación de datos a un Encargado para que los trate por cuenta del Responsable) y{" "}
          <strong>Transferencia</strong> (envío de datos a otro Responsable).
        </p>
      </LegalSection>

      <LegalSection n={3} title="Calidad en la que actuamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Como Responsable</strong>, de los datos de las personas que crean una cuenta en
            la Plataforma: propietarios, administradores y personal de las guarderías, hoteles y
            centros caninos que la usan (los “Clientes”), y de quienes nos contactan.
          </li>
          <li>
            <strong>Como Encargado</strong>, de los datos que cada Cliente registra sobre sus propios
            clientes (dueños de mascotas) y su personal. En ese caso el Cliente es el Responsable,
            debe contar con la autorización de esos titulares y el tratamiento se rige por el{" "}
            <a href={LEGAL_DOCS.data_processing.path} className="text-amber-700 underline">
              {LEGAL_DOCS.data_processing.title}
            </a>
            . Ponemos a su disposición un{" "}
            <a href={CUSTOMER_AUTHORIZATION_PATH} className="text-amber-700 underline">modelo de autorización</a>.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={4} title="Datos que tratamos">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Usuarios de la Plataforma:</strong> nombre, correo electrónico, teléfono, cargo o rol, organización a la que pertenecen, credenciales de acceso (la contraseña se guarda cifrada) y registros de actividad.</li>
          <li><strong>Clientes de las guarderías</strong> (como Encargado): nombre, documento si el Cliente lo registra, teléfono, correo, dirección, contacto de emergencia, historial de reservas, pagos y comunicaciones.</li>
          <li><strong>Mascotas:</strong> nombre, raza, edad, peso, fotografías, vacunas, alergias, medicación y otros datos veterinarios. No son datos personales sensibles de personas, pero los protegemos con el mismo cuidado.</li>
          <li><strong>Ubicación:</strong> la dirección del cliente para rutas de recogida y, cuando el personal lo autoriza en su dispositivo, la ubicación puntual al marcar “Salí hacia aquí”.</li>
          <li><strong>Pagos:</strong> los procesa LemonSqueezy. No almacenamos números de tarjeta.</li>
          <li><strong>Técnicos:</strong> dirección IP, navegador, registros de errores y de uso para seguridad y funcionamiento (ver <a href={LEGAL_DOCS.cookies.path} className="text-amber-700 underline">{LEGAL_DOCS.cookies.title}</a>).</li>
        </ul>
        <p>
          La Plataforma no está diseñada para recolectar datos sensibles (art. 5 Ley 1581) ni datos
          de niños, niñas y adolescentes. Los Clientes no deben registrarlos. Si excepcionalmente
          se tratan, la respuesta a preguntas sobre ellos es facultativa y se requiere autorización
          expresa.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Finalidades del tratamiento">
        <ul className="list-disc space-y-1 pl-5">
          <li>Crear y administrar cuentas, autenticar usuarios y gestionar permisos por rol.</li>
          <li>Prestar el servicio contratado: reservas, check-in, perreras, tareas, rutas, fichas clínicas, reportes, paquetes y comprobantes.</li>
          <li>Enviar comunicaciones transaccionales: confirmación de cuenta, recuperación de contraseña, invitaciones, reportes y avisos de servicio.</li>
          <li>Enviar, por cuenta del Cliente y solo a quienes no se hayan opuesto, campañas y notificaciones (correo, SMS o WhatsApp).</li>
          <li>Gestionar la suscripción, cobros y facturación con el Cliente.</li>
          <li>Brindar soporte, atender peticiones, consultas y reclamos.</li>
          <li>Garantizar la seguridad, prevenir fraude y abuso, y diagnosticar errores.</li>
          <li>Elaborar estadísticas agregadas y anónimas para mejorar la Plataforma.</li>
          <li>Cumplir obligaciones legales y requerimientos de autoridades competentes.</li>
        </ul>
        <p>No vendemos ni cedemos datos personales a terceros con fines comerciales.</p>
      </LegalSection>

      <LegalSection n={6} title="Autorización">
        <p>
          Obtenemos la autorización de los usuarios al crear su cuenta o aceptar una invitación,
          mediante una casilla que no viene marcada, y conservamos prueba de ella (fecha, hora,
          versión del documento aceptado). Para los clientes de las guarderías, la Plataforma
          exige que el Cliente confirme que cuenta con la autorización del titular antes de
          registrarlo, y guarda quién lo confirmó y cuándo.
        </p>
        <p>
          No se requiere autorización en los casos del artículo 10 de la Ley 1581 de 2012 (por
          ejemplo, datos de naturaleza pública o requerimientos de autoridad).
        </p>
      </LegalSection>

      <LegalSection n={7} title="Derechos de los titulares">
        <p>Conforme al artículo 8 de la Ley 1581 de 2012, el titular tiene derecho a:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Conocer, actualizar y rectificar sus datos personales.</li>
          <li>Solicitar prueba de la autorización otorgada.</li>
          <li>Ser informado sobre el uso que se ha dado a sus datos.</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC), una vez agotado el trámite ante el Responsable o Encargado.</li>
          <li>Revocar la autorización y/o solicitar la supresión de sus datos cuando no exista un deber legal o contractual de conservarlos.</li>
          <li>Acceder en forma gratuita a sus datos personales.</li>
        </ul>
      </LegalSection>

      <LegalSection n={8} title="Procedimiento para consultas y reclamos">
        <p>
          El área responsable de atender peticiones, consultas y reclamos es el equipo de
          protección de datos de {op}, a través del correo <LegalValue value={LEGAL.dataEmail} label="Correo" />.
          La solicitud debe incluir el nombre del titular, la forma de contactarlo, la descripción
          de lo que solicita y, si actúa un tercero, el documento que acredite su representación.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Consultas:</strong> se responden en un máximo de <strong>diez (10) días hábiles</strong>{" "}
            desde su recibo. Si no es posible, se informará el motivo y la fecha de respuesta, que
            no superará cinco (5) días hábiles adicionales (art. 14 Ley 1581).
          </li>
          <li>
            <strong>Reclamos</strong> (corrección, actualización, supresión o incumplimiento): si
            están incompletos, se pedirá completarlos dentro de los cinco (5) días siguientes; si
            pasan dos (2) meses sin respuesta del interesado, se entenderá desistido. Una vez
            completo, se incluirá la leyenda “reclamo en trámite” y se resolverá en máximo{" "}
            <strong>quince (15) días hábiles</strong>, prorrogables por ocho (8) días hábiles
            informando el motivo (art. 15 Ley 1581).
          </li>
          <li>
            Si la solicitud se refiere a datos que una guardería registró sobre su cliente, la
            trasladaremos a esa guardería (Responsable) y le prestaremos apoyo para responder.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={9} title="Transmisión y transferencia internacional">
        <p>
          Para operar la Plataforma transmitimos datos a proveedores que actúan como encargados y
          almacenan o procesan la información en Estados Unidos, país que la SIC reconoce con
          nivel adecuado de protección:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Supabase</strong>: base de datos, autenticación y archivos.</li>
          <li><strong>Vercel</strong>: alojamiento de la aplicación web.</li>
          <li><strong>Resend</strong>: envío de correos electrónicos.</li>
          <li><strong>Twilio</strong>: envío de SMS y WhatsApp (cuando el Cliente lo activa).</li>
          <li><strong>Mapbox</strong>: geocodificación de direcciones para rutas.</li>
          <li><strong>Sentry</strong>: registro de errores (con enmascaramiento del contenido en pantalla).</li>
          <li><strong>LemonSqueezy</strong>: procesamiento de pagos de la suscripción.</li>
        </ul>
        <p>
          Estos proveedores solo tratan los datos para prestarnos su servicio y bajo obligaciones
          de confidencialidad y seguridad. Al aceptar esta Política, el titular autoriza esta
          transmisión.
        </p>
      </LegalSection>

      <LegalSection n={10} title="Seguridad de la información">
        <p>
          Aplicamos medidas técnicas, humanas y administrativas razonables: aislamiento de la
          información de cada organización a nivel de base de datos, permisos por rol, cifrado en
          tránsito (HTTPS) y en reposo por parte de nuestros proveedores, contraseñas cifradas y
          registro de actividad sensible. Si ocurre un incidente de seguridad que afecte datos
          personales, lo informaremos a la SIC y a los Clientes afectados conforme a la ley.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Conservación de los datos">
        <p>
          Los datos se conservan mientras la cuenta o la relación contractual esté vigente y
          durante el tiempo necesario para cumplir obligaciones legales, contables o atender
          reclamaciones. Terminada la suscripción, el Cliente puede exportar su información
          durante {LEGAL.exportDays} días; después se suprime, salvo deber legal de conservación.
        </p>
      </LegalSection>

      <LegalSection n={12} title="Vigencia y cambios">
        <p>
          Esta Política rige desde su publicación ({doc.updatedAt}). Los cambios sustanciales se
          comunicarán por la Plataforma o por correo antes de aplicarse y, cuando la ley lo
          exija, se solicitará una nueva autorización. Las bases de datos permanecerán vigentes
          mientras se desarrollen las finalidades descritas.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
