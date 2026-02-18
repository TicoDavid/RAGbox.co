/**
 * RAGbox.co - Next.js Configuration
 *
 * =====================================================================
 * AI SERVICE ENVIRONMENT VARIABLES (Beta)
 * =====================================================================
 *
 * REQUIRED (Next.js frontend):
 *   GOOGLE_CLOUD_PROJECT        - GCP project ID (e.g. "ragbox-sovereign-prod")
 *   DEEPGRAM_API_KEY            - Deepgram STT key for voice chat (useVoiceChat)
 *   GO_BACKEND_URL              - URL of the Go backend Cloud Run service
 *                                 (e.g. "https://ragbox-backend-xxxxx.us-east4.run.app")
 *
 * OPTIONAL (Next.js frontend):
 *   OPENROUTER_API_KEY          - OpenRouter key for Intelligence Matrix
 *                                 model selection (multi-model routing)
 *   DEEPSEEK_API_KEY            - DeepSeek API key for OCR fallback
 *   DEEPSEEK_ENDPOINT_URL       - DeepSeek endpoint URL for OCR fallback
 *
 * BACKEND-ONLY (configured in Go backend, NOT needed in Next.js):
 *   VERTEX_AI_LOCATION          - Vertex AI region (set in Go backend env)
 *   VERTEX_AI_MODEL             - Gemini model ID (set in Go backend env)
 *   DOCUMENT_AI_PROCESSOR_ID    - Document AI processor (Go backend)
 *   DLP_DEIDENTIFY_TEMPLATE     - Cloud DLP template (Go backend)
 *   BIGQUERY_DATASET            - BigQuery audit dataset (Go backend)
 *   BIGQUERY_TABLE              - BigQuery audit table (Go backend)
 *
 * =====================================================================
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode for better development experience
  reactStrictMode: true,

  // Enable standalone output for Docker deployment
  output: 'standalone',

  // Environment variables (runtime) — API keys must NOT be exposed here
  // Access OPENROUTER_API_KEY via process.env in server-side code only
  env: {},

  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
    // Disable image optimization in production if using Cloud Run
    // unoptimized: process.env.NODE_ENV === 'production',
  },

  // Webpack configuration for GCP client libraries
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle server-only modules on client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      }
    }
    return config
  },

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Server-side external packages (native/heavy modules that shouldn't be bundled)
    serverComponentsExternalPackages: [
      'ws',
      'bufferutil',
      'utf-8-validate',
      'pdf-parse',
      'mammoth',
      '@google-cloud/vertexai',
      '@google-cloud/aiplatform',
      '@google-cloud/text-to-speech',
      '@google-cloud/storage',
      '@google-cloud/bigquery',
      '@google-cloud/documentai',
      '@google-cloud/logging',
      '@google-cloud/pubsub',
      'google-auth-library',
      '@prisma/client',
    ],
    // Ensure Prisma query engine is included in standalone output
    outputFileTracingIncludes: {
      '/api/**': ['./node_modules/.prisma/**/*'],
    },
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://storage.googleapis.com https://*.googleusercontent.com",
              "media-src 'self' https://storage.googleapis.com",
              "connect-src 'self' https://*.googleapis.com https://*.deepgram.com https://openrouter.ai wss://*.deepgram.com wss: https://*.sentry.io https://*.ingest.sentry.io",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(nextConfig, {
  // Suppress build logs from Sentry
  silent: true,
  // Hide source maps from client bundles
  hideSourceMaps: true,
  // Disable telemetry
  telemetry: false,
});
