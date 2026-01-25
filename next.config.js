/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode for better development experience
  reactStrictMode: true,

  // Enable standalone output for Docker deployment
  output: 'standalone',

  // Environment variables (runtime)
  env: {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  },

  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
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
      bodySizeLimit: '10mb',
    },
    // Server-side external packages (native modules that shouldn't be bundled)
    serverComponentsExternalPackages: ['ws', 'bufferutil', 'utf-8-validate'],
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
        ],
      },
    ]
  },
}

module.exports = nextConfig
