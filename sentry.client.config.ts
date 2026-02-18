import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions in production

  // Session replay for debugging
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with errors

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Filter noisy errors
  ignoreErrors: [
    "ResizeObserver loop",
    "Network request failed",
    "AbortError",
    "cancelled",
  ],

  environment: process.env.NODE_ENV,
});
