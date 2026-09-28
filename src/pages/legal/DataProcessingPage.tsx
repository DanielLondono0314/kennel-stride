import { LegalLayout, LegalSection, OperatorInfo } from "./LegalLayout";
import { CUSTOMER_AUTHORIZATION_PATH, LEGAL, LEGAL_DOCS, operatorName } from "@/lib/legal";

const doc = LEGAL_DOCS.data_processing;
const link = "text-amber-700 underline";

export default function DataProcessingPage() {
  const op = operatorName();
  return (
    <LegalLayout title={doc.title} updated={doc.updatedAt} version={doc.version}>
      <p>
        Este contrato se celebra conforme al artículo 25 de la Ley 1581 de 2012 y al artículo
        2.2.2.25.5.2 del Decreto 1074 de 2015, entre la organización que usa{" "}
        <strong>{LEGAL.brand}</strong> (el “Responsable”), representada por el administrador que
        lo acepta electrónicamente al crear la organización, y {op} (el “Encargado”). Se entiende
        celebrado con esa aceptación, de la que queda registro de fecha, hora y versión.
      </p>

      <LegalSection n={1} title="El Encargado">
        <OperatorInfo />
      </LegalSection>

      <LegalSection n={2} title="Objeto y alcance">
        <p>
          El Encargado tratará, por cuenta del Responsable, los datos personales que este registre
          en la Plataforma sobre sus clientes (dueños de mascotas), contactos de emergencia y
          personal, únicamente para prestar el servicio contratado: almacenamiento, organización,
          consulta, envío de comunicaciones que el Responsable ordene y demás funciones de la
          Plataforma. El Encargado no usará esos datos para fines propios.
        </p>
      </LegalSection>

      <LegalSection n={3} title="Obligaciones del Responsable">
        <ul className="list-disc space-y-1 pl-5">
          <li>Obtener y conservar la autorización previa, expresa e informada de cada titular antes de registrar sus datos (puede usar el <a href={CUSTOMER_AUTHORIZATION_PATH} className={link}>modelo de autorización</a>), y confirmarla en la Plataforma.</li>
          <li>Contar con su propia política de tratamiento de datos e informarla a los titulares.</li>
          <li>Registrar solo datos pertinentes y no registrar datos sensibles ni de menores de edad.</li>
          <li>Atender las consultas y reclamos de sus titulares y ordenar al Encargado las correcciones o supresiones que correspondan.</li>
          <li>Enviar comunicaciones comerciales solo a quienes lo hayan autorizado, respetando la oposición y los horarios de la Ley 2300 de 2023.</li>
          <li>Asignar a su personal los roles y permisos adecuados y custodiar sus credenciales.</li>
        </ul>
      </LegalSection>

      <LegalSection n={4} title="Obligaciones del Encargado">
        <ul className="list-disc space-y-1 pl-5">
          <li>Tratar los datos solo según las instrucciones del Responsable y conforme a la Ley 1581 de 2012 y la política del Responsable.</li>
          <li>Garantizar la confidencialidad y adoptar medidas de seguridad técnicas, humanas y administrativas para impedir su adulteración, pérdida, consulta, uso o acceso no autorizado.</li>
          <li>Mantener los datos de cada organización aislados de los de las demás.</li>
          <li>Facilitar al Responsable la actualización, rectificación y supresión de datos, y apoyarlo para atender consultas y reclamos dentro de los plazos legales.</li>
          <li>Informar al Responsable y a la SIC, sin demora injustificada, cualquier incidente de seguridad que afecte los datos.</li>
          <li>Permitir el acceso a la información únicamente a las personas que la requieran para prestar el servicio.</li>
        </ul>
      </LegalSection>

      <LegalSection n={5} title="Subencargados">
        <p>
          El Responsable autoriza al Encargado para apoyarse en los proveedores listados en la{" "}
          <a href={LEGAL_DOCS.privacy.path} className={link}>{LEGAL_DOCS.privacy.title}</a> (infraestructura,
          correo, mensajería, mapas, monitoreo de errores y pagos), incluida su transmisión
          internacional a Estados Unidos. El Encargado exigirá a estos proveedores obligaciones de
          confidencialidad y seguridad equivalentes y avisará por la Plataforma cualquier cambio
          relevante de proveedores.
        </p>
      </LegalSection>

      <LegalSection n={6} title="Duración y terminación">
        <p>
          Este contrato está vigente mientras la organización use la Plataforma. Al terminar, el
          Encargado pondrá a disposición del Responsable la exportación de sus datos durante{" "}
          {LEGAL.exportDays} días y luego los suprimirá, salvo que la ley exija conservarlos.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Responsabilidad">
        <p>
          Cada parte responde por el cumplimiento de sus propias obligaciones legales. El
          Responsable mantendrá indemne al Encargado por reclamaciones derivadas de datos
          registrados sin autorización del titular o de instrucciones contrarias a la ley.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
