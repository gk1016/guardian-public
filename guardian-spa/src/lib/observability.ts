import * as Sentry from "@sentry/react";

// Guardian SPA Sentry init. Browser DSN is public by design (ships in the
// bundle). VITE_SENTRY_DSN overrides the fallback; the fallback is filled with
// the guardian-spa project's public DSN once the Sentry project exists.
// Privacy posture: SDK default integrations (incl. global error/rejection
// handlers for auto-capture) are kept so unhandled errors are actually reported.
// Session Replay is NOT a default (stays off); performance tracing is disabled
// via tracesSampleRate:0; sendDefaultPii off; a beforeSend hook strips request
// bodies / cookies / query strings / auth headers before send.
const DSN =
  (import.meta.env.VITE_SENTRY_DSN as string | undefined) ??
  "https://f15c96d78dd7b71ad93b6a00444c8a03@o4511576887918592.ingest.us.sentry.io/4511581217030144";

export function initObservability(): void {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.query_string;
        if (event.request.headers) {
          delete event.request.headers["Authorization"];
          delete event.request.headers["Cookie"];
        }
      }
      return event;
    },
  });
}
