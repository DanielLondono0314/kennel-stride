import { useMemo } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface ServiceTypeOption {
  value: string;
  label: string;
}

export const DEFAULT_SERVICE_TYPES: ServiceTypeOption[] = [
  { value: "daycare", label: "Guardería" },
  { value: "board_and_train", label: "Internado + Entrenamiento" },
  { value: "training_session", label: "Sesión de Entrenamiento" },
  { value: "grooming", label: "Grooming" },
  { value: "evaluation", label: "Evaluación" },
];

/**
 * Tipos de servicio de la org (configurables en Ajustes > Perfil del
 * Negocio, `organizations.service_types`), con fallback a los 5 por
 * defecto. Única fuente de verdad — antes cada pantalla (reservas,
 * solicitudes, calendario, report cards) tenía su propia lista hardcodeada
 * y un servicio personalizado agregado en Ajustes solo aparecía en
 * report cards, no en el formulario de reservas.
 */
export function useServiceTypes() {
  const { organization } = useOrganization();

  const options = useMemo<ServiceTypeOption[]>(
    () => (organization?.service_types?.length ? organization.service_types : DEFAULT_SERVICE_TYPES),
    [organization?.service_types]
  );

  const labels = useMemo<Record<string, string>>(
    () => Object.fromEntries(options.map((o) => [o.value, o.label])),
    [options]
  );

  return { options, labels };
}
