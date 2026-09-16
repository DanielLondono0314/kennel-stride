import * as Sentry from "@sentry/react";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
    // Session Replay: queda con los defaults de Sentry (maskAllText +
    // blockAllMedia) porque la app maneja datos sensibles de mascotas/
    // clientes (medicación, alergias, facturación) — nunca desactivar el
    // masking para "ver mejor" un replay.
    replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    enabled: true,
  });
}

export { Sentry };
