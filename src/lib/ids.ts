const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ¿Es un UUID? Las fichas (/customers/:id, /dogs/:id, /reservations/:id)
 * validan el id antes de consultar: con "abc" Postgres responde 400 y cada
 * consulta se reintentaba 3 veces (QA E-14).
 */
export function isUuid(value: string | undefined | null): value is string {
  return !!value && UUID_RE.test(value);
}
