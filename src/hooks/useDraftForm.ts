import { useEffect, useRef, useState } from "react";

interface UseDraftFormOptions<T> {
  /** Clave de localStorage. `null` desactiva la persistencia (ej. al editar). */
  key: string | null;
  /** Normalmente `open` del modal — solo persiste mientras está visible. */
  active: boolean;
  /** Snapshot actual del formulario (objeto plano, serializable a JSON). */
  value: T;
  /** Repuebla el formulario con un borrador restaurado. */
  apply: (draft: T) => void;
  /** Si el formulario está "vacío" no vale la pena guardar/restaurar nada. */
  isEmpty: (value: T) => boolean;
}

/**
 * Autoguarda un borrador de formulario en localStorage mientras el usuario
 * escribe, y lo restaura si el modal se cierra sin guardar (navegación,
 * cambio de pestaña/app, Escape, clic afuera) y se vuelve a abrir. Se limpia
 * solo cuando el caller llama `clearDraft()` (típicamente tras guardar con
 * éxito) — nunca automáticamente al cerrar, para no perder nada por
 * accidente.
 */
export function useDraftForm<T>({ key, active, value, apply, isEmpty }: UseDraftFormOptions<T>) {
  const [hasDraft, setHasDraft] = useState(false);
  const restoredForKeyRef = useRef<string | null>(null);

  // Restaurar al abrir (una sola vez por apertura de este key).
  useEffect(() => {
    if (!active || !key) return;
    if (restoredForKeyRef.current === key) return;
    restoredForKeyRef.current = key;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as T;
      apply(draft);
      setHasDraft(true);
    } catch {
      localStorage.removeItem(key);
    }
    // Deliberado: solo debe correr al abrir, no en cada cambio de `apply`/`value`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);

  // Permite que la próxima apertura vuelva a intentar restaurar.
  useEffect(() => {
    if (!active) restoredForKeyRef.current = null;
  }, [active]);

  // Guardar continuamente mientras hay cambios.
  const serialized = JSON.stringify(value);
  useEffect(() => {
    if (!active || !key) return;
    if (isEmpty(value)) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, serialized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, serialized]);

  const clearDraft = () => {
    if (key) localStorage.removeItem(key);
    setHasDraft(false);
  };

  return { hasDraft, clearDraft, setHasDraft };
}
