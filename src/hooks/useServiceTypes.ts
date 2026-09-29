import { useCallback, useMemo } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { categoryOf, type ServiceCategory } from "@/lib/reportCardServices";
import { normalizeService, type CatalogService } from "@/lib/serviceCatalog";

export interface ServiceTypeOption {
  value: string;
  label: string;
  /** Categoría para el report card; si falta se infiere del nombre. */
  category?: string;
}

export const DEFAULT_SERVICE_TYPES: ServiceTypeOption[] = [
  { value: "daycare", label: "Guardería" },
  { value: "board_and_train", label: "Internado + Entrenamiento" },
  { value: "training_session", label: "Sesión de Entrenamiento" },
  { value: "grooming", label: "Grooming" },
  { value: "evaluation", label: "Evaluación" },
];

/**
 * Catálogo de servicios de la org (Configuración → Servicios,
 * `organizations.service_types`), con fallback a los 5 por defecto. Única
 * fuente de verdad para reservas, solicitudes, calendario y report cards.
 *
 * `options` = servicios activos (para elegir en formularios nuevos);
 * `labels` / `categoryFor` cubren TODOS, también los desactivados, para que
 * una reserva vieja siga mostrando el nombre de su servicio.
 */
export function useServiceTypes() {
  const { organization } = useOrganization();

  const catalog = useMemo<CatalogService[]>(
    () =>
      (organization?.service_types?.length ? organization.service_types : DEFAULT_SERVICE_TYPES).map((s) =>
        normalizeService(s as unknown as Record<string, unknown>)
      ),
    [organization?.service_types]
  );

  const options = useMemo<ServiceTypeOption[]>(
    () => catalog.filter((s) => s.active).map(({ value, label, category }) => ({ value, label, category })),
    [catalog]
  );

  const labels = useMemo<Record<string, string>>(
    () => Object.fromEntries(catalog.map((o) => [o.value, o.label])),
    [catalog]
  );

  const categories = useMemo<Record<string, ServiceCategory>>(
    () => Object.fromEntries(catalog.map((o) => [o.value, categoryOf(o)])),
    [catalog]
  );

  /** Categoría de un service_type, aunque ya no exista en la lista de la org. */
  const categoryFor = useCallback(
    (value: string): ServiceCategory => categories[value] ?? categoryOf(undefined, value),
    [categories]
  );

  return { catalog, options, labels, categories, categoryFor };
}
