// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/observability/sentry-scrub";

Sentry.init({
  dsn: "https://ebed79ec3d990f32f23c201d7ac3da63@o4510618444824576.ingest.us.sentry.io/4510618449149952",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,

  // Strip contact-PII from every event before transmission (client runtime).
  beforeSend(event) { scrubEvent(event); return event; },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
