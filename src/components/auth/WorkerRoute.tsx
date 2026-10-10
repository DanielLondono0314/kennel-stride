import { Navigate, useLocation, useParams } from "react-router-dom";

/**
 * La app de trabajador (/worker/*) se unificó con el panel: cada enlace viejo
 * (marcadores, notificaciones, mensajes ya enviados) lleva a su equivalente.
 */
const LEGACY_WORKER_PATHS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^$/, () => "my-day"],
  [/^schedule$/, () => "my-schedule"],
  [/^route$/, () => "my-route"],
  [/^(task|reservation)\/(.+)$/, (m) => `my-day/${m[1]}/${m[2]}`],
  [/^dogs$/, () => "my-day/dogs"],
  [/^dog\/(.+)$/, (m) => `my-day/dog/${m[1]}`],
  [/^kennels$/, () => "facility?vista=perreras"],
  [/^health$/, () => "clinic"],
  [/^notices$/, () => "notices"],
  [/^profile$/, () => "profile"],
];

export function legacyWorkerTarget(rest: string): string {
  const clean = rest.replace(/^\/+|\/+$/g, "");
  for (const [re, to] of LEGACY_WORKER_PATHS) {
    const m = clean.match(re);
    if (m) return to(m);
  }
  return "my-day";
}

export function LegacyWorkerRedirect() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { pathname, search } = useLocation();
  const rest = pathname.split("/worker")[1] ?? "";
  const target = legacyWorkerTarget(rest);
  const sep = target.includes("?") ? "&" : "?";
  return <Navigate to={`/${orgSlug}/${target}${search ? sep + search.slice(1) : ""}`} replace />;
}
