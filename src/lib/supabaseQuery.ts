// Utilidades para consultas PostgREST.

const PAGE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** PostgREST corta en 1000 filas: pagina hasta traerlas todas. El callback
 *  debe aplicar `.range(from, to)` y un `.order(...)` estable. */
export async function fetchAll<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/**
 * Filtro `.or()` de búsqueda ILIKE sobre varias columnas. El término va entre
 * comillas dobles: sin eso, una coma o un paréntesis del usuario
 * ("Pérez, Juan") rompía la sintaxis del filtro y la búsqueda fallaba.
 */
export function ilikeAny(columns: string[], term: string): string {
  const escaped = term.trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return columns.map((c) => `${c}.ilike."%${escaped}%"`).join(",");
}
