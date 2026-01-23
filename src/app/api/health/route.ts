/**
 * Health Check API - RAGbox.co
 *
 * Endpoint for Cloud Run health checks and monitoring.
 * Returns system health status and basic diagnostics.
 */

import { NextResponse } from 'next/server'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  checks: {
    name: string
    status: 'pass' | 'fail'
    latency?: number
    message?: string
  }[]
}

// Track server start time for uptime calculation
const startTime = Date.now()

/**
 * GET /api/health
 *
 * Returns current health status of the application.
 * Used by:
 * - Cloud Run liveness/readiness probes
 * - Load balancer health checks
 * - Monitoring systems
 */
export async function GET(): Promise<NextResponse<HealthStatus>> {
  const checks: HealthStatus['checks'] = []

  // Check environment configuration
  const envCheck = checkEnvironment()
  checks.push(envCheck)

  // Determine overall status
  const allPassing = checks.every((c) => c.status === 'pass')
  const anyFailing = checks.some((c) => c.status === 'fail')

  let overallStatus: HealthStatus['status'] = 'healthy'
  if (anyFailing) {
    overallStatus = 'unhealthy'
  } else if (!allPassing) {
    overallStatus = 'degraded'
  }

  const response: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  }

  // Return appropriate status code
  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503

  return NextResponse.json(response, { status: statusCode })
}

/**
 * Check required environment variables
 */
function checkEnvironment(): HealthStatus['checks'][0] {
  const required = ['GOOGLE_CLOUD_PROJECT']

  const optional = ['DATABASE_URL', 'GCS_BUCKET_NAME', 'VERTEX_AI_LOCATION']

  const missingRequired = required.filter((key) => !process.env[key])
  const missingOptional = optional.filter((key) => !process.env[key])

  if (missingRequired.length > 0) {
    return {
      name: 'environment',
      status: 'fail',
      message: `Missing required env vars: ${missingRequired.join(', ')}`,
    }
  }

  if (missingOptional.length > 0) {
    return {
      name: 'environment',
      status: 'pass',
      message: `Missing optional env vars: ${missingOptional.join(', ')}`,
    }
  }

  return {
    name: 'environment',
    status: 'pass',
  }
}

/**
 * HEAD /api/health
 *
 * Lightweight health check for load balancers.
 */
export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200 })
}
