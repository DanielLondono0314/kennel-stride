/**
 * supabase.functions.invoke() no exponen el body JSON del error en
 * `error.message` (queda genérico: "Edge Function returned a non-2xx status
 * code") — el detalle real vive en `error.context`, un Response sin leer.
 * Esto lo extrae para poder mostrar el motivo real al usuario.
 */
export async function getFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.clone().json();
      if (body?.error) return body.error as string;
    } catch {
      // body no era JSON — seguimos con el fallback
    }
  }
  return (error as Error)?.message || fallback;
}
