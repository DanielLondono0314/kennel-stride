import { LegalLayout, LegalSection } from "./LegalLayout";
import { LEGAL, LEGAL_DOCS } from "@/lib/legal";

const doc = LEGAL_DOCS.cookies;

export default function CookiesPage() {
  return (
    <LegalLayout title={doc.title} updated={doc.updatedAt} version={doc.version}>
      <p>
        Esta política explica qué tecnologías de almacenamiento usa <strong>{LEGAL.brand}</strong>{" "}
        en tu navegador y para qué. No usamos cookies publicitarias ni vendemos información de
        navegación.
      </p>

      <LegalSection n={1} title="Almacenamiento estrictamente necesario">
        <p>Sin estas tecnologías la Plataforma no puede funcionar, por lo que no requieren consentimiento:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Sesión (Supabase):</strong> mantiene tu sesión iniciada de forma segura.</li>
          <li><strong>Borradores de formularios:</strong> guardan temporalmente lo que escribes para que no se pierda si recargas la página.</li>
          <li><strong>Preferencias:</strong> recuerdan ajustes de la interfaz, como el estado del menú lateral.</li>
        </ul>
      </LegalSection>

      <LegalSection n={2} title="Monitoreo de errores y seguridad (Sentry)">
        <p>
          Cuando ocurre un error registramos datos técnicos (navegador, página, mensaje de error)
          y, en una muestra de sesiones, una reproducción de la interfaz en la que{" "}
          <strong>todo el texto y las imágenes quedan enmascarados</strong>, de modo que no se
          ven datos de clientes ni de mascotas. Se usa solo para corregir fallos y proteger la
          Plataforma.
        </p>
      </LegalSection>

      <LegalSection n={3} title="Cómo controlarlo">
        <p>
          Puedes borrar o bloquear el almacenamiento desde la configuración de tu navegador. Si
          bloqueas el almacenamiento necesario, no podrás iniciar sesión. Si en el futuro se
          incorporan herramientas de analítica o publicidad, se pedirá tu consentimiento antes
          de activarlas y se actualizará esta política.
        </p>
      </LegalSection>

      <LegalSection n={4} title="Más información">
        <p>
          El tratamiento de datos personales se rige por la{" "}
          <a href={LEGAL_DOCS.privacy.path} className="text-amber-700 underline">{LEGAL_DOCS.privacy.title}</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
